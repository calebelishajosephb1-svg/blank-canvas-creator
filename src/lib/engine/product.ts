import { DFA } from "./dfa";

export type ProductOp = "intersect" | "union" | "difference" | "symdiff";

export const PRODUCT_OPS: { id: ProductOp; label: string; symbol: string; blurb: string }[] = [
  { id: "intersect", label: "Intersection", symbol: "A ∩ B", blurb: "Accept only when BOTH machines accept." },
  { id: "union", label: "Union", symbol: "A ∪ B", blurb: "Accept when EITHER machine accepts." },
  { id: "difference", label: "Difference", symbol: "A \\ B", blurb: "Accept when A accepts and B rejects." },
  { id: "symdiff", label: "Symmetric difference", symbol: "A △ B", blurb: "Accept when exactly one accepts — every string here is a counterexample to equivalence." },
];

export function acceptsPair(op: ProductOp, a: boolean, b: boolean): boolean {
  switch (op) {
    case "intersect":
      return a && b;
    case "union":
      return a || b;
    case "difference":
      return a && !b;
    case "symdiff":
      return a !== b;
  }
}

export interface ProductResult {
  dfa: DFA;
  /** product state label -> the pair of parent states it stands for */
  pairs: Record<string, { a: string; b: string }>;
  reachable: number;
}

export const pairLabel = (a: string, b: string) => `${a}·${b}`;

/** Reachable-only product construction of two DFAs over a shared alphabet. */
export function productAutomaton(a: DFA, b: DFA, op: ProductOp): ProductResult | null {
  if (!a.startState || !b.startState) return null;
  const alphabet = a.alphabet.filter((s) => b.alphabet.includes(s));
  if (!alphabet.length) return null;

  const pairs: Record<string, { a: string; b: string }> = {};
  const states: string[] = [];
  const transitions: Record<string, Record<string, string>> = {};
  const acceptStates: string[] = [];

  const startLabel = pairLabel(a.startState, b.startState);
  const queue: { a: string; b: string }[] = [{ a: a.startState, b: b.startState }];
  pairs[startLabel] = { a: a.startState, b: b.startState };
  states.push(startLabel);

  while (queue.length) {
    const cur = queue.shift()!;
    const label = pairLabel(cur.a, cur.b);
    if (acceptsPair(op, a.isAccepting(cur.a), b.isAccepting(cur.b))) acceptStates.push(label);
    transitions[label] = {};
    for (const sym of alphabet) {
      const na = a.transition(cur.a, sym);
      const nb = b.transition(cur.b, sym);
      if (!na || !nb) continue; // partial machine: dead transition
      const nl = pairLabel(na, nb);
      transitions[label][sym] = nl;
      if (!pairs[nl]) {
        pairs[nl] = { a: na, b: nb };
        states.push(nl);
        queue.push({ a: na, b: nb });
      }
    }
  }

  return {
    dfa: new DFA({ states, alphabet, transitions, startState: startLabel, acceptStates }),
    pairs,
    reachable: states.length,
  };
}

/** Shortest string in the product language, or null when the language is empty. */
export function shortestAccepted(dfa: DFA, maxLen = 14): string | null {
  if (!dfa.startState) return null;
  const seen = new Set<string>([dfa.startState]);
  const queue: { state: string; word: string }[] = [{ state: dfa.startState, word: "" }];
  while (queue.length) {
    const { state, word } = queue.shift()!;
    if (dfa.isAccepting(state)) return word;
    if (word.length >= maxLen) continue;
    for (const sym of dfa.alphabet) {
      const next = dfa.transition(state, sym);
      if (!next || seen.has(next)) continue;
      seen.add(next);
      queue.push({ state: next, word: word + sym });
    }
  }
  return null;
}
