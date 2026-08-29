import { useEffect, useMemo, useState } from "react";
import { DFACanvas, type HighlightTone } from "@/components/DFACanvas";
import { regexToDFA } from "@/lib/engine/regex";
import { productAutomaton, shortestAccepted, PRODUCT_OPS, pairLabel, type ProductOp } from "@/lib/engine/product";
import { dfaToMachine } from "@/lib/machine";
import { audioPulse } from "@/lib/audio";

interface Props {
  active: boolean;
  onContext?: (fn: () => string) => void;
}

const ALPHABET = ["0", "1"];

const PRESETS = [
  { label: "Ends with 1", regex: "(0|1)*1" },
  { label: "Even number of 0s", regex: "(1*01*01*)*" },
  { label: "Contains 11", regex: "(0|1)*11(0|1)*" },
  { label: "Starts with 0", regex: "0(0|1)*" },
  { label: "Length divisible by 3", regex: "((0|1)(0|1)(0|1))*" },
];

export function ProductLab({ active, onContext }: Props) {
  const [regexA, setRegexA] = useState(PRESETS[0]!.regex);
  const [regexB, setRegexB] = useState(PRESETS[1]!.regex);
  const [op, setOp] = useState<ProductOp>("intersect");
  const [input, setInput] = useState("0101");
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const dfaA = useMemo(() => regexToDFA(regexA, ALPHABET), [regexA]);
  const dfaB = useMemo(() => regexToDFA(regexB, ALPHABET), [regexB]);
  const product = useMemo(() => (dfaA && dfaB ? productAutomaton(dfaA, dfaB, op) : null), [dfaA, dfaB, op]);

  const machineA = useMemo(() => (dfaA ? dfaToMachine(dfaA) : null), [dfaA]);
  const machineB = useMemo(() => (dfaB ? dfaToMachine(dfaB) : null), [dfaB]);
  const machineP = useMemo(() => (product ? dfaToMachine(product.dfa) : null), [product]);

  const witness = useMemo(() => (product ? shortestAccepted(product.dfa) : null), [product]);

  const symbols = useMemo(() => [...input].filter((c) => ALPHABET.includes(c)), [input]);
  const maxStep = symbols.length;

  /** Dual pulse: both parents and the product advance on the same symbol. */
  const walk = useMemo(() => {
    if (!dfaA || !dfaB || !product) return null;
    const a: (string | null)[] = [dfaA.startState];
    const b: (string | null)[] = [dfaB.startState];
    const p: (string | null)[] = [product.dfa.startState];
    for (const sym of symbols) {
      a.push(dfaA.transition(a[a.length - 1] ?? null, sym));
      b.push(dfaB.transition(b[b.length - 1] ?? null, sym));
      p.push(product.dfa.transition(p[p.length - 1] ?? null, sym));
    }
    return {
      a,
      b,
      p,
      acceptA: dfaA.isAccepting(a[a.length - 1] ?? null),
      acceptB: dfaB.isAccepting(b[b.length - 1] ?? null),
      acceptP: product.dfa.isAccepting(p[p.length - 1] ?? null),
    };
  }, [dfaA, dfaB, product, symbols]);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [regexA, regexB, op, input]);

  useEffect(() => {
    if (!playing) return;
    if (step >= maxStep) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [playing, step, maxStep]);

  useEffect(() => {
    if (!walk || !active || step === 0) return;
    if (step >= maxStep) (walk.acceptP ? audioPulse.accept() : audioPulse.reject());
    else audioPulse.tick();
  }, [step, walk, maxStep, active]);

  useEffect(() => {
    onContext?.(() =>
      [
        "Module: Product Lab (product automaton, dual pulse)",
        `A = ${regexA}`,
        `B = ${regexB}`,
        `Operation: ${op}`,
        product ? `Product reachable states: ${product.reachable}` : "Product could not be built.",
        witness === null ? "Product language is EMPTY." : `Shortest accepted string: "${witness || "ε"}"`,
        `Test string: "${input}" (step ${step}/${maxStep})`,
      ].join("\n"),
    );
  }, [onContext, regexA, regexB, op, product, witness, input, step, maxStep]);

  const hl = (
    machine: ReturnType<typeof dfaToMachine> | null,
    label: string | null | undefined,
    tone: HighlightTone,
  ): Record<string, HighlightTone> => {
    if (!machine || !label) return {};
    const s = machine.states.find((st) => st.label === label);
    return s ? { [s.id]: tone } : {};
  };

  const currentPair = walk && walk.a[step] && walk.b[step] ? pairLabel(walk.a[step]!, walk.b[step]!) : null;
  const opMeta = PRODUCT_OPS.find((o) => o.id === op)!;

  return (
    <div className="module-container">
      <aside className="module-panel-left" style={{ width: 330, flexShrink: 0 }}>
        <div>
          <span className="badge" data-tone="blue">
            Product Lab
          </span>
          <h2 className="mt-2 text-lg">Two machines, one tape</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-muted)" }}>
            The product machine's state is literally the pair of states its parents are sitting in. Watch all three move
            in lockstep.
          </p>
        </div>

        <div className="lab-card flex flex-col gap-2">
          <span className="section-label">Machine A</span>
          <input className="input-field" value={regexA} onChange={(e) => setRegexA(e.target.value)} spellCheck={false} />
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button key={`a${p.label}`} className="badge" onClick={() => setRegexA(p.regex)}>
                {p.label}
              </button>
            ))}
          </div>
          <span className="section-label">Machine B</span>
          <input className="input-field" value={regexB} onChange={(e) => setRegexB(e.target.value)} spellCheck={false} />
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button key={`b${p.label}`} className="badge" onClick={() => setRegexB(p.regex)}>
                {p.label}
              </button>
            ))}
          </div>
          {(!dfaA || !dfaB) && (
            <span className="text-[11px]" style={{ color: "var(--signal-rose)" }}>
              One of the patterns is invalid over Σ = {"{0,1}"}.
            </span>
          )}
        </div>

        <div className="lab-card flex flex-col gap-2">
          <span className="section-label">Operation</span>
          {PRODUCT_OPS.map((o) => (
            <button key={o.id} className="tape-row" data-verdict={o.id === op ? "accept" : undefined} onClick={() => setOp(o.id)}>
              <span>{o.symbol}</span>
              <span style={{ color: "var(--ink-disabled)" }}>{o.label}</span>
            </button>
          ))}
          <span className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
            {opMeta.blurb}
          </span>
        </div>

        <div className="lab-card flex flex-col gap-2">
          <span className="section-label">Dual pulse</span>
          <input className="input-field" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} />
          <div className="flex items-center gap-1.5">
            <button
              className="btn-primary"
              onClick={() => (step >= maxStep ? (setStep(0), setPlaying(true)) : setPlaying((p) => !p))}
            >
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
              <span key={i} className="badge" data-tone={i < step ? "blue" : undefined} style={{ fontFamily: "var(--font-mono-family)" }}>
                {c}
              </span>
            ))}
          </div>
          {currentPair && (
            <span className="text-[11px]" style={{ color: "var(--ink-muted)", fontFamily: "var(--font-mono-family)" }}>
              pair = ({walk?.a[step]}, {walk?.b[step]})
            </span>
          )}
          {walk && step >= maxStep && maxStep >= 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="badge" data-tone={walk.acceptA ? "cyan" : "rose"}>
                A {walk.acceptA ? "accepts" : "rejects"}
              </span>
              <span className="badge" data-tone={walk.acceptB ? "cyan" : "rose"}>
                B {walk.acceptB ? "accepts" : "rejects"}
              </span>
              <span className="badge" data-tone={walk.acceptP ? "cyan" : "rose"}>
                {opMeta.symbol} {walk.acceptP ? "accepts" : "rejects"}
              </span>
            </div>
          )}
        </div>

        {product && (
          <div className="lab-card flex flex-col gap-1 text-[11px]" style={{ color: "var(--ink-muted)" }}>
            <span>{product.reachable} reachable pairs.</span>
            {witness === null ? (
              <span style={{ color: "var(--signal-amber)" }}>
                The language is empty — no string satisfies {opMeta.symbol}.
              </span>
            ) : (
              <button className="badge" data-tone="blue" onClick={() => setInput(witness)}>
                shortest witness: "{witness || "ε"}" — load it
              </button>
            )}
          </div>
        )}
      </aside>

      <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="lab-card">
            <span className="section-label">A — {regexA}</span>
            {machineA && (
              <DFACanvas machine={machineA} alphabet={ALPHABET} editable={false} highlights={hl(machineA, walk?.a[step], "cyan")} />
            )}
          </div>
          <div className="lab-card">
            <span className="section-label">B — {regexB}</span>
            {machineB && (
              <DFACanvas machine={machineB} alphabet={ALPHABET} editable={false} highlights={hl(machineB, walk?.b[step], "amber")} />
            )}
          </div>
        </div>
        <div className="lab-card">
          <span className="section-label">Product — {opMeta.symbol}</span>
          {machineP ? (
            <DFACanvas machine={machineP} alphabet={ALPHABET} editable={false} highlights={hl(machineP, walk?.p[step], "blue")} />
          ) : (
            <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Fix both patterns to build the product.
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
