import { DFA } from "@/lib/engine/dfa";
import { EPS, NFA } from "@/lib/engine/nfa";
import { dfaToMachine, layoutMachine, type Machine } from "@/lib/machine";

/**
 * Render an NFA (nondeterministic + ε edges) as a drawable Machine.
 * dfaToMachine only keeps one target per symbol, so extra branches are
 * appended manually afterwards.
 */
export function nfaToMachine(nfa: NFA): Machine {
  const skeleton = new DFA({
    states: nfa.states,
    alphabet: [...nfa.alphabet, EPS],
    transitions: Object.fromEntries(
      Object.entries(nfa.transitions).map(([from, row]) => [
        from,
        Object.fromEntries(
          Object.entries(row)
            .filter(([, tos]) => tos.length > 0)
            .map(([sym, tos]) => [sym, tos[0]!]),
        ),
      ]),
    ),
    startState: nfa.startStates[0] ?? null,
    acceptStates: nfa.acceptStates,
  });

  const machine = layoutMachine(dfaToMachine(skeleton));
  const idOf = (label: string) => machine.states.find((s) => s.label === label)?.id;
  let n = machine.transitions.length;
  for (const [from, row] of Object.entries(nfa.transitions)) {
    for (const [sym, tos] of Object.entries(row)) {
      for (const to of tos) {
        const f = idOf(from);
        const t = idOf(to);
        if (!f || !t) continue;
        const existing = machine.transitions.find((e) => e.from === f && e.to === t);
        if (existing) {
          if (!existing.symbols.includes(sym)) existing.symbols.push(sym);
        } else machine.transitions.push({ id: `x${++n}`, from: f, to: t, symbols: [sym] });
      }
    }
  }
  return machine;
}

/** Map machine state labels to canvas ids, for highlight props. */
export function idsForLabels(machine: Machine, labels: Iterable<string>): string[] {
  const out: string[] = [];
  for (const label of labels) {
    const s = machine.states.find((st) => st.label === label);
    if (s) out.push(s.id);
  }
  return out;
}
