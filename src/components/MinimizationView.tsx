import { useEffect, useMemo, useState } from "react";
import { DFACanvas, type HighlightTone } from "@/components/DFACanvas";
import { minimize, type RefinementStep } from "@/lib/engine/algorithms";
import type { DFA } from "@/lib/engine/dfa";
import { dfaToMachine, layoutMachine } from "@/lib/machine";

/** Muted group palette — deliberately not signal-blue/cyan/rose. */
const GROUP_COLORS = ["#7C8CA8", "#8E7CA8", "#7CA894", "#A8997C", "#A87C8C", "#7C97A8"];

export function MinimizationView({ dfa, alphabet, onClose }: { dfa: DFA; alphabet: string[]; onClose: () => void }) {
  const { steps, minimal } = useMemo(() => {
    const trace: RefinementStep[] = [];
    const result = minimize(dfa, trace);
    return { steps: trace, minimal: result };
  }, [dfa]);

  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const step = steps[Math.min(i, steps.length - 1)];

  const original = useMemo(() => layoutMachine(dfaToMachine(dfa)), [dfa]);
  const minimalMachine = useMemo(() => layoutMachine(dfaToMachine(minimal)), [minimal]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      setI((n) => {
        if (n >= steps.length - 1) {
          setPlaying(false);
          return n;
        }
        return n + 1;
      });
    }, 1200);
    return () => window.clearTimeout(id);
  }, [playing, i, steps.length]);

  // colour states by the partition block they currently sit in
  const highlights = useMemo(() => {
    const out: Record<string, HighlightTone> = {};
    return out;
  }, []);

  const blockColors = useMemo(() => {
    const map: Record<string, string> = {};
    const partition = step?.partition.length ? step.partition : step?.resultingGroups ?? [];
    partition.forEach((g, gi) => g.forEach((s) => (map[s] = GROUP_COLORS[gi % GROUP_COLORS.length]!)));
    return map;
  }, [step]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <span className="badge" data-tone="amber">
              Minimization
            </span>
            <h3 className="mt-2 text-lg">Partition refinement, round by round</h3>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mt-3 grid gap-px" style={{ gridTemplateColumns: "1fr 1fr", background: "var(--border-subtle)" }}>
          <div className="flex min-h-0 flex-col" style={{ background: "var(--panel)" }}>
            <div className="section-label px-3 py-2">Original — {original.states.length} states, coloured by block</div>
            <DFACanvas machine={original} alphabet={alphabet} editable={false} mode="pointer" highlights={highlights} stateColors={blockColors} />
          </div>
          <div className="flex min-h-0 flex-col" style={{ background: "var(--panel)" }}>
            <div className="section-label px-3 py-2">Minimal — {minimal.states.length} states</div>
            <DFACanvas machine={minimalMachine} alphabet={alphabet} editable={false} mode="pointer" />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="tool-btn" onClick={() => setPlaying((p) => !p)} data-active={playing}>
            {playing ? "❙❙" : "▶"}
          </button>
          <button className="btn-ghost" onClick={() => { setPlaying(false); setI((n) => Math.max(0, n - 1)); }}>
            Prev
          </button>
          <button className="btn-ghost" onClick={() => { setPlaying(false); setI((n) => Math.min(steps.length - 1, n + 1)); }}>
            Next
          </button>
          <span className="text-xs" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono-family)" }}>
            step {i + 1}/{steps.length} · {original.states.length} → {minimal.states.length} states
          </span>
        </div>

        <div className="lab-card mt-3 max-h-40 overflow-y-auto">
          {steps.slice(0, i + 1).map((s, n) => (
            <p
              key={n}
              className="py-1 text-xs"
              style={{ color: n === i ? "var(--ink-primary)" : "var(--ink-muted)", fontFamily: "var(--font-mono-family)" }}
            >
              {s.caption}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
