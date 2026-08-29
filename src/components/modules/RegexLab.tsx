import { useEffect, useMemo, useState } from "react";
import { DFACanvas, type HighlightTone } from "@/components/DFACanvas";
import { regexToNFA, validateRegex } from "@/lib/engine/regex";
import { minimize } from "@/lib/engine/algorithms";
import { relabel } from "@/lib/engine/relabel";
import { dfaToMachine } from "@/lib/machine";
import { nfaToMachine } from "@/lib/nfa-machine";
import { audioPulse } from "@/lib/audio";
import type { DFA } from "@/lib/engine/dfa";
import type { NFA } from "@/lib/engine/nfa";

interface Props {
  active: boolean;
  onContext?: (fn: () => string) => void;
}

const SAMPLES: { pattern: string; alphabet: string; note: string }[] = [
  { pattern: "(0|1)*1", alphabet: "0,1", note: "Ends with 1" },
  { pattern: "a(a|b)*b", alphabet: "a,b", note: "Starts a, ends b" },
  { pattern: "(ab)+", alphabet: "a,b", note: "One or more ab blocks" },
  { pattern: "0*10*10*", alphabet: "0,1", note: "Exactly two 1s" },
];

function pane(title: string, subtitle: string) {
  return (
    <div className="mb-1 flex items-baseline justify-between">
      <span className="section-label">{title}</span>
      <span className="text-[11px]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono-family)" }}>
        {subtitle}
      </span>
    </div>
  );
}

export function RegexLab({ active, onContext }: Props) {
  const [pattern, setPattern] = useState("(0|1)*1");
  const [alphabetText, setAlphabetText] = useState("0,1");
  const [input, setInput] = useState("0101");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const alphabet = useMemo(
    () =>
      Array.from(
        new Set(
          alphabetText
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ),
    [alphabetText],
  );

  const check = useMemo(() => validateRegex(pattern, alphabet), [pattern, alphabet]);

  const built = useMemo(() => {
    if (!check.valid) return null;
    try {
      const nfa: NFA = regexToNFA(pattern, alphabet);
      const raw = nfa.toDFA().dfa;
      const dfa = relabel(raw, "d");
      const minimal: DFA = relabel(minimize(raw), "m");
      return { nfa, dfa, minimal };
    } catch {
      return null;
    }
  }, [pattern, alphabet, check.valid]);

  const nfaMachine = useMemo(() => (built ? nfaToMachine(built.nfa) : null), [built]);
  const dfaMachine = useMemo(() => (built ? dfaToMachine(built.dfa) : null), [built]);
  const minMachine = useMemo(() => (built ? dfaToMachine(built.minimal) : null), [built]);

  const symbols = useMemo(() => [...input].filter((c) => alphabet.includes(c)), [input, alphabet]);

  /** Synchronised walk: NFA active set + DFA state + minimal DFA state per prefix length. */
  const walk = useMemo(() => {
    if (!built) return null;
    const nfaSets: Set<string>[] = [built.nfa.epsilonClosure(built.nfa.startStates)];
    const dfaStates: (string | null)[] = [built.dfa.startState];
    const minStates: (string | null)[] = [built.minimal.startState];
    for (const sym of symbols) {
      const prev = nfaSets[nfaSets.length - 1]!;
      nfaSets.push(built.nfa.epsilonClosure(built.nfa.move(prev, sym)));
      dfaStates.push(built.dfa.transition(dfaStates[dfaStates.length - 1] ?? null, sym));
      minStates.push(built.minimal.transition(minStates[minStates.length - 1] ?? null, sym));
    }
    const last = minStates[minStates.length - 1] ?? null;
    return { nfaSets, dfaStates, minStates, accepted: built.minimal.isAccepting(last) };
  }, [built, symbols]);

  const maxStep = symbols.length;
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [pattern, alphabetText, input]);

  useEffect(() => {
    if (!playing) return;
    if (step >= maxStep) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 620);
    return () => clearTimeout(t);
  }, [playing, step, maxStep]);

  useEffect(() => {
    if (!walk || !active) return;
    if (step === 0) return;
    if (step >= maxStep) (walk.accepted ? audioPulse.accept() : audioPulse.reject());
    else audioPulse.tick();
  }, [step, walk, maxStep, active]);

  useEffect(() => {
    onContext?.(() =>
      [
        "Module: Regex Lab (regex → NFA → DFA triptych)",
        `Pattern: ${pattern}`,
        `Alphabet: ${alphabet.join(",")}`,
        built
          ? `NFA states: ${built.nfa.states.length}, subset DFA: ${built.dfa.states.length}, minimal: ${built.minimal.states.length}`
          : `Pattern invalid: ${check.error ?? "unknown"}`,
        `Test string: "${input}" (step ${step}/${maxStep})`,
        walk ? `Verdict: ${walk.accepted ? "accept" : "reject"}` : "",
      ].join("\n"),
    );
  }, [onContext, pattern, alphabet, built, check.error, input, step, maxStep, walk]);

  const nfaHighlights = useMemo(() => {
    const out: Record<string, HighlightTone> = {};
    if (!walk || !nfaMachine) return out;
    for (const label of walk.nfaSets[step] ?? []) {
      const s = nfaMachine.states.find((st) => st.label === label);
      if (s) out[s.id] = "cyan";
    }
    return out;
  }, [walk, nfaMachine, step]);

  const highlightOne = (
    machine: ReturnType<typeof dfaToMachine> | null,
    label: string | null | undefined,
    tone: HighlightTone,
  ): Record<string, HighlightTone> => {
    if (!machine || !label) return {};
    const s = machine.states.find((st) => st.label === label);
    return s ? { [s.id]: tone } : {};
  };

  return (
    <div className="module-container">
      <aside className="module-panel-left" style={{ width: 330, flexShrink: 0 }}>
        <div>
          <span className="badge" data-tone="blue">
            Regex Lab
          </span>
          <h2 className="mt-2 text-lg">Regex → NFA → DFA</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            Thompson construction on the left, subset construction in the middle, minimal DFA on the right. One string
            pulses through all three at once.
          </p>
        </div>

        <div className="lab-card flex flex-col gap-2">
          <span className="section-label">Pattern</span>
          <input
            className="input-field"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            spellCheck={false}
            placeholder="(0|1)*1"
          />
          <span className="section-label">Alphabet</span>
          <input className="input-field" value={alphabetText} onChange={(e) => setAlphabetText(e.target.value)} />
          {!check.valid && (
            <span className="text-[11px]" style={{ color: "var(--signal-rose)" }}>
              {check.error}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="section-label">Try one</span>
          {SAMPLES.map((s) => (
            <button
              key={s.pattern}
              className="tape-row"
              data-verdict={s.pattern === pattern ? "accept" : undefined}
              onClick={() => {
                setPattern(s.pattern);
                setAlphabetText(s.alphabet);
              }}
            >
              <span style={{ fontFamily: "var(--font-mono-family)" }}>{s.pattern}</span>
              <span style={{ color: "var(--ink-disabled)" }}>{s.note}</span>
            </button>
          ))}
        </div>

        <div className="lab-card flex flex-col gap-2">
          <span className="section-label">Pulse a string</span>
          <input
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            placeholder="0101"
          />
          <div className="flex items-center gap-1.5">
            <button className="btn-primary" onClick={() => (step >= maxStep ? (setStep(0), setPlaying(true)) : setPlaying((p) => !p))}>
              {playing ? "Pause" : step >= maxStep && maxStep > 0 ? "Replay" : "Play"}
            </button>
            <button className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Prev
            </button>
            <button className="btn-ghost" onClick={() => setStep((s) => Math.min(maxStep, s + 1))}>
              Next
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {symbols.map((c, i) => (
              <span
                key={i}
                className="badge"
                data-tone={i < step ? "blue" : undefined}
                style={{ fontFamily: "var(--font-mono-family)" }}
              >
                {c}
              </span>
            ))}
            {!symbols.length && (
              <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
                ε (empty string)
              </span>
            )}
          </div>
          {walk && step >= maxStep && (
            <span className="badge" data-tone={walk.accepted ? "cyan" : "rose"}>
              {walk.accepted ? "accepted" : "rejected"}
            </span>
          )}
        </div>

        {built && (
          <div className="lab-card text-[11px]" style={{ color: "var(--ink-muted)" }}>
            {built.nfa.states.length} NFA states → {built.dfa.states.length} subset states →{" "}
            {built.minimal.states.length} minimal states.
            {built.dfa.states.length > built.minimal.states.length
              ? " Subset construction over-counted; equivalent states merged."
              : " Subset construction landed on the minimal machine directly."}
          </div>
        )}
      </aside>

      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {!built ? (
          <div className="lab-card text-sm" style={{ color: "var(--ink-muted)" }}>
            Enter a valid pattern over the alphabet to build the triptych.
          </div>
        ) : (
          <>
            <div className="lab-card">
              {pane("1 — Thompson NFA", `${built.nfa.states.length} states · ε-edges allowed`)}
              {nfaMachine && (
                <DFACanvas
                  machine={nfaMachine}
                  alphabet={built.nfa.alphabet}
                  editable={false}
                  allowNondet
                  allowEpsilon
                  highlights={nfaHighlights}
                />
              )}
            </div>
            <div className="lab-card">
              {pane("2 — Subset construction DFA", `${built.dfa.states.length} states`)}
              {dfaMachine && (
                <DFACanvas
                  machine={dfaMachine}
                  alphabet={built.dfa.alphabet}
                  editable={false}
                  highlights={highlightOne(dfaMachine, walk?.dfaStates[step], "blue")}
                />
              )}
            </div>
            <div className="lab-card">
              {pane("3 — Minimal DFA", `${built.minimal.states.length} states`)}
              {minMachine && (
                <DFACanvas
                  machine={minMachine}
                  alphabet={built.minimal.alphabet}
                  editable={false}
                  highlights={highlightOne(minMachine, walk?.minStates[step], "amber")}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
