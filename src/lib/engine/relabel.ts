import { DFA } from "./dfa";

/**
 * Rename states to short q0, q1, … names (BFS order from the start state).
 * Subset construction produces labels like "n0,n2,n4,n7" that are unreadable
 * on a canvas; the language is unchanged.
 */
export function relabel(dfa: DFA, prefix = "q"): DFA {
  if (!dfa.startState) return dfa;
  const order: string[] = [dfa.startState];
  const seen = new Set(order);
  for (let i = 0; i < order.length; i++) {
    const cur = order[i]!;
    for (const sym of dfa.alphabet) {
      const next = dfa.transition(cur, sym);
      if (next && !seen.has(next)) {
        seen.add(next);
        order.push(next);
      }
    }
  }
  for (const s of dfa.states) if (!seen.has(s)) order.push(s);

  const map = new Map(order.map((s, i) => [s, `${prefix}${i}`]));
  const name = (s: string) => map.get(s) ?? s;

  const transitions: Record<string, Record<string, string>> = {};
  for (const [from, row] of Object.entries(dfa.transitions)) {
    if (!map.has(from)) continue;
    transitions[name(from)] = Object.fromEntries(
      Object.entries(row)
        .filter(([, to]) => map.has(to))
        .map(([sym, to]) => [sym, name(to)]),
    );
  }

  return new DFA({
    states: order.map(name),
    alphabet: [...dfa.alphabet],
    transitions,
    startState: name(dfa.startState),
    acceptStates: dfa.acceptStates.filter((s) => map.has(s)).map(name),
  });
}
