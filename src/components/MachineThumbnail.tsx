import { CANVAS_H, CANVAS_W, type Machine } from "@/lib/machine";

/** Tiny, label-free, non-interactive rendering of a machine's shape. */
export function MachineThumbnail({
  machine,
  width = 84,
  height = 60,
  active = false,
}: {
  machine: Machine;
  width?: number;
  height?: number;
  active?: boolean;
}) {
  const byId = new Map(machine.states.map((s) => [s.id, s]));
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        borderRadius: 6,
        background: "var(--panel-deep, rgba(4,7,15,.6))",
        outline: active ? "2px solid var(--signal-blue)" : "1px solid var(--border-subtle)",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {machine.transitions.map((t) => {
        const a = byId.get(t.from);
        const b = byId.get(t.to);
        if (!a || !b) return null;
        if (a.id === b.id)
          return <circle key={t.id} cx={a.x} cy={a.y - 34} r={22} fill="none" stroke="var(--ink-disabled)" strokeWidth={6} />;
        return (
          <line key={t.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--ink-disabled)" strokeWidth={6} />
        );
      })}
      {machine.states.map((s) => (
        <circle
          key={s.id}
          cx={s.x}
          cy={s.y}
          r={s.isAccepting ? 26 : 20}
          fill={s.isStart ? "var(--signal-blue)" : "var(--panel-raised, #0B142A)"}
          stroke={s.isAccepting ? "var(--signal-cyan)" : "var(--signal-blue)"}
          strokeWidth={s.isAccepting ? 9 : 6}
        />
      ))}
    </svg>
  );
}
