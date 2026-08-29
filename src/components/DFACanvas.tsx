import { useCallback, useEffect, useRef, useState } from "react";
import {
  CANVAS_H,
  CANVAS_W,
  STATE_R,
  type Machine,
  type MachineState,
  type MachineTransition,
} from "@/lib/machine";
import { checkTransitionConflict } from "@/lib/engine/validate";

export type CanvasMode = "pointer" | "state" | "transition" | "delete";
export type HighlightTone = "blue" | "cyan" | "rose" | "amber";

const TONE_VAR: Record<HighlightTone, string> = {
  blue: "var(--signal-blue)",
  cyan: "var(--signal-cyan)",
  rose: "var(--signal-rose)",
  amber: "var(--signal-amber)",
};

interface Props {
  machine: Machine;
  onChange?: (next: Machine | ((prev: Machine) => Machine)) => void;
  editable?: boolean;
  alphabet: string[];
  allowNondet?: boolean;
  allowEpsilon?: boolean;
  mode?: CanvasMode;
  highlights?: Record<string, HighlightTone>;
  activeTransition?: { from: string; to: string } | null;
}

interface PendingEdge {
  from: string;
  to: string;
  symbols: string[];
  existingId: string | null;
  x: number;
  y: number;
}

function edgeGeometry(a: MachineState, b: MachineState, curved: boolean) {
  if (a.id === b.id) {
    return {
      path: `M ${a.x - 14} ${a.y - STATE_R + 4} C ${a.x - 54} ${a.y - 78}, ${a.x + 54} ${a.y - 78}, ${a.x + 14} ${a.y - STATE_R + 4}`,
      labelX: a.x,
      labelY: a.y - 74,
    };
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const sx = a.x + ux * (STATE_R + 2);
  const sy = a.y + uy * (STATE_R + 2);
  const ex = b.x - ux * (STATE_R + 9);
  const ey = b.y - uy * (STATE_R + 9);
  if (!curved) {
    return { path: `M ${sx} ${sy} L ${ex} ${ey}`, labelX: (sx + ex) / 2 - uy * 14, labelY: (sy + ey) / 2 + ux * 14 - 4 };
  }
  const bend = 42;
  const mx = (sx + ex) / 2 - uy * bend;
  const my = (sy + ey) / 2 + ux * bend;
  return { path: `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`, labelX: mx - uy * 6, labelY: my + ux * 6 - 2 };
}

export function DFACanvas({
  machine,
  onChange,
  editable = true,
  alphabet,
  allowNondet = false,
  allowEpsilon = false,
  mode = "pointer",
  highlights = {},
  activeTransition = null,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [transFrom, setTransFrom] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<PendingEdge | null>(null);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const symbolChoices = allowEpsilon ? [...alphabet, "ε"] : alphabet;

  const toLocal = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }, []);

  const hitState = useCallback(
    (x: number, y: number) => machine.states.find((s) => Math.hypot(s.x - x, s.y - y) <= STATE_R + 4) ?? null,
    [machine.states],
  );

  const nextLabel = useCallback(() => {
    let i = 0;
    const used = new Set(machine.states.map((s) => s.label));
    while (used.has(`q${i}`)) i++;
    return `q${i}`;
  }, [machine.states]);

  const addStateAt = (x: number, y: number) => {
    onChange?.((prev) => {
      const id = `s${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
      const label = nextLabel();
      return {
        ...prev,
        states: [
          ...prev.states,
          {
            id,
            label,
            x: Math.max(STATE_R + 6, Math.min(CANVAS_W - STATE_R - 6, x)),
            y: Math.max(STATE_R + 6, Math.min(CANVAS_H - STATE_R - 6, y)),
            isStart: prev.states.length === 0,
            isAccepting: false,
          },
        ],
      };
    });
  };

  const deleteState = (id: string) => {
    onChange?.((prev) => {
      const states = prev.states.filter((s) => s.id !== id);
      if (states.length && !states.some((s) => s.isStart)) states[0] = { ...states[0], isStart: true };
      return { states, transitions: prev.transitions.filter((t) => t.from !== id && t.to !== id) };
    });
    setSelected(null);
    setConfirmDelete(null);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setMenu(null);
    const { x, y } = toLocal(e);
    const hit = hitState(x, y);
    if (!editable) {
      setSelected(hit?.id ?? null);
      return;
    }
    if (mode === "state") {
      if (!hit) addStateAt(x, y);
      return;
    }
    if (mode === "delete") {
      if (hit) {
        if (confirmDelete === hit.id) deleteState(hit.id);
        else {
          setConfirmDelete(hit.id);
          window.setTimeout(() => setConfirmDelete((c) => (c === hit.id ? null : c)), 3000);
        }
      }
      return;
    }
    if (mode === "transition") {
      if (!hit) {
        setTransFrom(null);
        setGhost(null);
        return;
      }
      if (!transFrom) {
        setTransFrom(hit.id);
        setGhost({ x, y });
        return;
      }
      const existing = machine.transitions.find((t) => t.from === transFrom && t.to === hit.id) ?? null;
      setPending({
        from: transFrom,
        to: hit.id,
        symbols: existing ? [...existing.symbols] : [],
        existingId: existing?.id ?? null,
        x: hit.x,
        y: hit.y,
      });
      setTransFrom(null);
      setGhost(null);
      return;
    }
    // pointer: select + drag only, never creates
    if (hit) {
      setSelected(hit.id);
      setDragging(hit.id);
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else setSelected(null);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x, y } = toLocal(e);
    if (transFrom) setGhost({ x, y });
    if (!dragging || !editable) return;
    onChange?.((prev) => ({
      ...prev,
      states: prev.states.map((s) =>
        s.id === dragging
          ? {
              ...s,
              x: Math.max(STATE_R + 4, Math.min(CANVAS_W - STATE_R - 4, x)),
              y: Math.max(STATE_R + 4, Math.min(CANVAS_H - STATE_R - 4, y)),
            }
          : s,
      ),
    }));
  };

  const onPointerUp = () => setDragging(null);

  const applyPending = () => {
    if (!pending) return;
    onChange?.((prev) => {
      const others = prev.transitions.filter((t) => t.id !== pending.existingId);
      if (!pending.symbols.length) return { ...prev, transitions: others };
      const edge: MachineTransition = {
        id: pending.existingId ?? `t${Date.now().toString(36)}`,
        from: pending.from,
        to: pending.to,
        symbols: [...pending.symbols],
      };
      return { ...prev, transitions: [...others, edge] };
    });
    setPending(null);
  };

  const toggleSymbol = (sym: string) => {
    setPending((p) => (p ? { ...p, symbols: p.symbols.includes(sym) ? p.symbols.filter((s) => s !== sym) : [...p.symbols, sym] } : p));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (e.key === "Escape") {
        setPending(null);
        setMenu(null);
        setTransFrom(null);
        setRenaming(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected && editable) deleteState(selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, editable]);

  const byId = (id: string) => machine.states.find((s) => s.id === id);
  const existingEdges = machine.transitions.map((t) => ({ from: t.from, to: t.to, symbols: t.symbols }));

  return (
    <div className="canvas-surface" onContextMenu={(e) => e.preventDefault()}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full touch-none select-none"
        style={{ cursor: mode === "state" ? "copy" : mode === "delete" ? "not-allowed" : "default" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (!editable) return;
          const { x, y } = toLocal(e);
          const hit = hitState(x, y);
          if (hit) onChange?.((prev) => ({ ...prev, states: prev.states.map((s) => (s.id === hit.id ? { ...s, isAccepting: !s.isAccepting } : s)) }));
          else addStateAt(x, y);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!editable) return;
          const { x, y } = toLocal(e);
          const hit = hitState(x, y);
          if (hit) setMenu({ id: hit.id, x: hit.x, y: hit.y });
        }}
      >
        <defs>
          <pattern id="lab-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="1.2" cy="1.2" r="1.2" fill="var(--grid-line)" />
          </pattern>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--border-strong)" />
          </marker>
          <marker id="arr-hl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--signal-blue)" />
          </marker>
          <filter id="state-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width={CANVAS_W} height={CANVAS_H} fill="url(#lab-grid)" />

        {transFrom && ghost && byId(transFrom) && (
          <line
            x1={byId(transFrom)!.x}
            y1={byId(transFrom)!.y}
            x2={ghost.x}
            y2={ghost.y}
            stroke="var(--signal-blue)"
            strokeWidth="2"
            strokeDasharray="6 5"
            opacity="0.8"
          />
        )}

        {machine.transitions.map((t) => {
          const a = byId(t.from);
          const b = byId(t.to);
          if (!a || !b) return null;
          const hasReverse = machine.transitions.some((o) => o.from === t.to && o.to === t.from && o.id !== t.id);
          const g = edgeGeometry(a, b, hasReverse);
          const active =
            activeTransition && a.label === activeTransition.from && b.label === activeTransition.to;
          return (
            <g key={t.id}>
              <path
                d={g.path}
                fill="none"
                stroke={active ? "var(--signal-blue)" : "var(--border-strong)"}
                strokeWidth={active ? 3 : 2}
                markerEnd={active ? "url(#arr-hl)" : "url(#arr)"}
                opacity={active ? 1 : 0.85}
              />
              <text
                x={g.labelX}
                y={g.labelY}
                textAnchor="middle"
                fontFamily="var(--font-mono-family)"
                fontSize="13"
                fill={active ? "var(--signal-blue)" : "var(--ink-muted)"}
                style={{ paintOrder: "stroke", stroke: "var(--bg-canvas)", strokeWidth: 5 }}
              >
                {t.symbols.join(",")}
              </text>
            </g>
          );
        })}

        {machine.states.map((s) => {
          const tone = highlights[s.label];
          const isSel = selected === s.id || transFrom === s.id;
          const confirming = confirmDelete === s.id;
          const stroke = confirming
            ? "var(--signal-amber)"
            : tone
              ? TONE_VAR[tone]
              : isSel
                ? "var(--signal-blue)"
                : "var(--border-strong)";
          return (
            <g key={s.id} style={{ cursor: editable && mode === "pointer" ? "grab" : "inherit" }}>
              {s.isStart && (
                <path
                  d={`M ${s.x - STATE_R - 30} ${s.y} L ${s.x - STATE_R - 5} ${s.y}`}
                  stroke="var(--signal-blue)"
                  strokeWidth="2.5"
                  markerEnd="url(#arr-hl)"
                />
              )}
              {tone && <circle cx={s.x} cy={s.y} r={STATE_R + 8} fill="none" stroke={TONE_VAR[tone]} strokeWidth="1.5" opacity="0.55" filter="url(#state-glow)" />}
              {s.isAccepting && <circle cx={s.x} cy={s.y} r={STATE_R + 5} fill="none" stroke={stroke} strokeWidth="1.8" />}
              <circle
                cx={s.x}
                cy={s.y}
                r={STATE_R}
                fill={tone ? `color-mix(in srgb, ${TONE_VAR[tone]} 22%, var(--bg-panel))` : "var(--bg-panel-raised)"}
                stroke={stroke}
                strokeWidth={isSel || tone ? 2.6 : 1.8}
              />
              <text
                x={s.x}
                y={s.y + 4.5}
                textAnchor="middle"
                fontFamily="var(--font-mono-family)"
                fontSize="13"
                fill="var(--ink-primary)"
              >
                {s.label}
              </text>
              {confirming && (
                <text x={s.x} y={s.y + STATE_R + 20} textAnchor="middle" fontSize="10" fill="var(--signal-amber)">
                  click again to delete
                </text>
              )}
            </g>
          );
        })}

        {!machine.states.length && (
          <text x={CANVAS_W / 2} y={CANVAS_H / 2} textAnchor="middle" fill="var(--ink-disabled)" fontSize="14">
            Click to add a state
          </text>
        )}
      </svg>

      {pending && (
        <div
          className="absolute z-20 w-[min(280px,90%)] rounded-2xl border p-3"
          style={{
            left: `min(calc(100% - 290px), ${(pending.x / CANVAS_W) * 100}%)`,
            top: `min(calc(100% - 150px), ${(pending.y / CANVAS_H) * 100}%)`,
            background: "var(--bg-panel)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-panel)",
          }}
        >
          <div className="section-label mb-2">
            {byId(pending.from)?.label} → {byId(pending.to)?.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {symbolChoices.map((sym) => {
              const on = pending.symbols.includes(sym);
              const conflict =
                !allowNondet &&
                !on &&
                checkTransitionConflict(
                  existingEdges.filter((e) => e.to !== pending.to),
                  pending.from,
                  pending.to,
                  sym,
                ).valid === false;
              return (
                <button
                  key={sym}
                  className="chip"
                  data-on={on}
                  data-blocked={conflict}
                  disabled={conflict}
                  onClick={() => toggleSymbol(sym)}
                  title={conflict ? "Determinism: this symbol is already used from this state" : undefined}
                >
                  {sym}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={applyPending}>
              Done
            </button>
          </div>
        </div>
      )}

      {menu && (
        <div
          className="absolute z-20 w-52 overflow-hidden rounded-xl border py-1 text-xs"
          style={{
            left: `min(calc(100% - 215px), ${(menu.x / CANVAS_W) * 100}%)`,
            top: `min(calc(100% - 160px), ${(menu.y / CANVAS_H) * 100}%)`,
            background: "var(--bg-panel)",
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-panel)",
          }}
        >
          {renaming?.id === menu.id ? (
            <form
              className="p-2"
              onSubmit={(e) => {
                e.preventDefault();
                const value = renaming.value.trim();
                if (value) onChange?.((prev) => ({ ...prev, states: prev.states.map((s) => (s.id === menu.id ? { ...s, label: value } : s)) }));
                setRenaming(null);
                setMenu(null);
              }}
            >
              <input
                autoFocus
                className="field-input"
                value={renaming.value}
                onChange={(e) => setRenaming({ id: menu.id, value: e.target.value })}
              />
            </form>
          ) : (
            <>
              <MenuItem
                label="Set as start"
                onClick={() => {
                  onChange?.((prev) => ({ ...prev, states: prev.states.map((s) => ({ ...s, isStart: s.id === menu.id })) }));
                  setMenu(null);
                }}
              />
              <MenuItem
                label="Toggle accepting"
                onClick={() => {
                  onChange?.((prev) => ({
                    ...prev,
                    states: prev.states.map((s) => (s.id === menu.id ? { ...s, isAccepting: !s.isAccepting } : s)),
                  }));
                  setMenu(null);
                }}
              />
              <MenuItem label="Rename…" onClick={() => setRenaming({ id: menu.id, value: byId(menu.id)?.label ?? "" })} />
              <MenuItem label="Delete state" tone="reject" onClick={() => deleteState(menu.id)} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "reject" }) {
  return (
    <button
      className="block w-full px-3 py-2 text-left transition-colors hover:bg-[var(--signal-blue-10)]"
      style={{ color: tone === "reject" ? "var(--signal-rose)" : "var(--ink-primary)" }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
