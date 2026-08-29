import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DFACanvas, type CanvasMode } from "@/components/DFACanvas";
import { CanvasToolbar } from "@/components/CanvasToolbar";
import { ChallengePicker } from "@/components/ChallengePicker";
import { FIXED_CHALLENGES, type Challenge } from "@/lib/engine/challenges";
import { languageDiff, minimize, type LanguageDiff } from "@/lib/engine/algorithms";
import { validateDFA } from "@/lib/engine/validate";
import { dfaToMachine, layoutMachine, machineToDFA, useMachine, type Machine } from "@/lib/machine";
import { useCanvasShortcuts } from "@/lib/useCanvasShortcuts";
import { buildMutationContext } from "@/lib/tutor/context";
import { MachineThumbnail } from "@/components/MachineThumbnail";
import { MinimizationView } from "@/components/MinimizationView";

export function MutationLab({ active, onContext }: { active: boolean; onContext: (ctx: () => string) => void }) {
  const [challenge, setChallenge] = useState<Challenge>(FIXED_CHALLENGES[0]!);
  const [mode, setMode] = useState<CanvasMode>("pointer");
  const [diff, setDiff] = useState<LanguageDiff | null>(null);
  const [testStr, setTestStr] = useState("");
  const [testOut, setTestOut] = useState<string | null>(null);
  const [history, setHistory] = useState<{ at: number; machine: Machine; label: string }[]>([]);
  const [showMinimization, setShowMinimization] = useState(false);
  const [filmIndex, setFilmIndex] = useState<number | null>(null);
  const original = useMemo(() => layoutMachine(dfaToMachine(challenge.dfa)), [challenge]);
  const { machine, commit, replace, undo, redo, canUndo, canRedo } = useMachine(original);

  const alphabet = challenge.alphabet;
  const mutated = useMemo(() => machineToDFA(machine, alphabet), [machine, alphabet]);
  const errors = useMemo(() => validateDFA(mutated), [mutated]);

  useCanvasShortcuts(active, setMode, { undo, redo });

  useEffect(() => {
    replace(original);
    setDiff(null);
    setHistory([]);
    setFilmIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id]);

  useEffect(() => {
    onContext(() =>
      buildMutationContext({
        challengeName: challenge.name,
        isEquivalent: diff?.isEquivalent ?? true,
        lost: diff?.lostExample ?? null,
        gained: diff?.gainedExample ?? null,
        minimal: diff?.isStillMinimal ?? true,
      }),
    );
  }, [onContext, challenge.name, diff]);

  const compute = () => {
    if (errors.length) {
      toast.error("Mutation is not a valid DFA", { description: errors[0] });
      return;
    }
    const d = languageDiff(challenge.dfa, mutated);
    setDiff(d);
    setHistory((h) => [{ at: Date.now(), machine, label: d.isEquivalent ? "equivalent" : "changed" }, ...h].slice(0, 25));
  };

  const testBoth = () => {
    const a = challenge.dfa.run(testStr);
    const b = errors.length ? null : mutated.run(testStr);
    setTestOut(
      `"${testStr || "ε"}" → original ${a ? "accept" : "reject"} · mutation ${b === null ? "invalid DFA" : b ? "accept" : "reject"}`,
    );
  };

  return (
    <div className="module-container">
      <aside className="module-panel-left" style={{ width: 340, flexShrink: 0 }}>
        <div>
          <span className="badge" data-tone="blue">
            Mutation Lab
          </span>
          <h2 className="mt-2 text-lg">{challenge.name}</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            Change one edge or one accepting flag on the right, then read what the language lost and gained.
          </p>
        </div>

        <div className="lab-card">
          <div className="mb-2 flex items-center justify-between">
            <span className="section-label">Language diff</span>
            {diff && (
              <span className="badge" data-tone={diff.isEquivalent ? "accept" : "reject"}>
                {diff.isEquivalent ? "Equivalent ✓" : "Language changed"}
              </span>
            )}
          </div>
          {diff ? (
            <div className="flex flex-col gap-2 text-xs" style={{ fontFamily: "var(--font-mono-family)" }}>
              <div className="tape-row" data-verdict="reject">
                <span>lost: {diff.lostExample === null ? "—" : diff.lostExample || "ε"}</span>
                {diff.lostExample !== null && (
                  <button className="btn-ghost" onClick={() => { setTestStr(diff.lostExample!); setTestOut(null); }}>
                    Replay
                  </button>
                )}
              </div>
              <div className="tape-row" data-verdict="accept">
                <span>gained: {diff.gainedExample === null ? "—" : diff.gainedExample || "ε"}</span>
                {diff.gainedExample !== null && (
                  <button className="btn-ghost" onClick={() => { setTestStr(diff.gainedExample!); setTestOut(null); }}>
                    Replay
                  </button>
                )}
              </div>
              <button
                className="badge"
                data-tone={diff.isStillMinimal ? "accept" : "amber"}
                onClick={() => setShowMinimization(true)}
                title="How would this minimize?"
              >
                {diff.isStillMinimal
                  ? "still minimal — how do we know?"
                  : `can be simplified to ${minimize(mutated).states.length} states — show me`}
              </button>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "var(--ink-disabled)" }}>
              Mutate, then press “Compute diff”.
            </p>
          )}
        </div>

        <div className="lab-card">
          <div className="section-label mb-2">Mutation history</div>
          {!history.length ? (
            <span className="text-xs" style={{ color: "var(--ink-disabled)" }}>
              Nothing yet — compute a diff to add a frame.
            </span>
          ) : (
            <div className="filmstrip">
              {[...history].reverse().map((h, idx) => (
                <button
                  key={h.at}
                  onClick={() => {
                    replace(h.machine);
                    setFilmIndex(idx);
                  }}
                  title={`${new Date(h.at).toLocaleTimeString()} · ${h.label}`}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <MachineThumbnail machine={h.machine} active={filmIndex === idx} />
                  <span className="mt-1 block text-center" style={{ fontSize: 9, color: "var(--ink-muted)" }}>
                    {h.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <ChallengePicker activeId={challenge.id} onPick={setChallenge} />

        {showMinimization && (
          <MinimizationView dfa={mutated} alphabet={alphabet} onClose={() => setShowMinimization(false)} />
        )}
      </aside>

      <section className="workbench">
        <CanvasToolbar
          mode={mode}
          setMode={setMode}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onLayout={() => commit((m) => layoutMachine(m))}
          alphabet={alphabet}
        >
          <button className="btn-ghost" onClick={() => replace(original)}>
            Reset
          </button>
          <button className="btn-ghost" onClick={() => replace(layoutMachine(dfaToMachine(minimize(mutated))))}>
            Minimize
          </button>
          <input className="field-input" style={{ width: 120 }} placeholder="test string" value={testStr} onChange={(e) => setTestStr(e.target.value)} />
          <button className="btn-ghost" onClick={testBoth}>
            Test both
          </button>
          <button className="btn-primary" onClick={compute}>
            Compute diff
          </button>
        </CanvasToolbar>

        <div className="dual-canvas grid flex-1 min-h-0 gap-px" style={{ gridTemplateColumns: "1fr 1fr", background: "var(--border-subtle)" }}>
          <div className="flex min-h-0 flex-col">
            <div className="section-label px-3 py-2">Original (read-only)</div>
            <DFACanvas machine={original} alphabet={alphabet} editable={false} mode="pointer" />
          </div>
          <div className="flex min-h-0 flex-col">
            <div className="section-label px-3 py-2">Your mutation</div>
            <DFACanvas machine={machine} onChange={commit} alphabet={alphabet} mode={mode} />
          </div>
        </div>

        <div className="px-4 py-3 text-xs" style={{ borderTop: "2px solid var(--signal-blue)", color: "var(--ink-muted)", fontFamily: "var(--font-mono-family)" }}>
          {testOut ?? "Two machines, one language question: does your edit actually change what is accepted?"}
        </div>
      </section>
    </div>
  );
}
