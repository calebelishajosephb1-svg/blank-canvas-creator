/** Answer guard: blocks concrete transition reveals for the ACTIVE exercise. */
export const FALLBACK_MESSAGE =
  "Let's not skip to the fix — try the next hint level, run a string through your machine, or say **\"make me a practice one\"** and I'll build an easier warm-up.";

const LEAK_PATTERNS: RegExp[] = [
  /\b[A-Za-z_][\w']*\s*-{1,2}\s*[^\s]{1,3}\s*-{0,2}>\s*[A-Za-z_][\w']*/, // q2 --1--> q0
  /\b[A-Za-z_][\w']*\s*(?:on|reading|with)\s*["'`]?[0-9a-z]["'`]?\s*(?:→|->|goes to|should go to)\s*[A-Za-z_][\w']*/i,
  /(?:δ|delta)\s*\(\s*[^)]*\)\s*=\s*[A-Za-z_][\w']*/i,
  /\(\s*[A-Za-z_][\w']*\s*,\s*[0-9a-z]\s*,\s*[A-Za-z_][\w']*\s*\)/,
  /\|\s*state\s*\|\s*(?:symbol|input)\s*\|/i,
  /(?:add|create|set|change|replace|point|redirect)\b[^.\n]{0,60}\btransition\b[^.\n]{0,60}\b(?:to|→|->)\s*[A-Za-z_][\w']*/i,
  /\bshould (?:go|point|lead) to\s+[A-Za-z_][\w']*/i,
];

const TABLE_ROW = /^\s*\|[^|\n]+\|[^|\n]+\|/gm;
const EDGE_MENTION = /[A-Za-z_][\w']*\s*-{1,2}\s*[^\s|]{1,3}\s*-{0,2}>\s*[A-Za-z_][\w']*/g;
const REGEX_REVEAL = /(\([^()]*\|[^()]*\)\s*[*+?])|(\[[^\]]+\]\s*[*+?])/;

export interface GuardContext {
  moduleId: string;
  hintLevelRevealed?: number;
}

export function checkReply(reply: string, ctx: GuardContext): { allowed: boolean; reason?: string; fallback: string } {
  const tableRows = reply.match(TABLE_ROW)?.length ?? 0;
  if (tableRows >= 2) return { allowed: false, reason: "transition-table dump", fallback: FALLBACK_MESSAGE };

  const edges = reply.match(EDGE_MENTION)?.length ?? 0;
  if (edges >= 2) return { allowed: false, reason: "explicit edge listing", fallback: FALLBACK_MESSAGE };

  for (const p of LEAK_PATTERNS) {
    if (p.test(reply)) return { allowed: false, reason: `pattern ${p.source.slice(0, 24)}`, fallback: FALLBACK_MESSAGE };
  }

  if (ctx.moduleId === "discovery" && REGEX_REVEAL.test(reply) && /this language|the language is|target language/i.test(reply)) {
    return { allowed: false, reason: "regex reveal of hidden language", fallback: FALLBACK_MESSAGE };
  }

  return { allowed: true, fallback: FALLBACK_MESSAGE };
}
