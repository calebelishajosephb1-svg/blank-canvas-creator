export type TutorAction =
  | { type: "highlight"; state: string; color: "blue" | "rose" | "cyan" | "amber" }
  | { type: "test"; value: string }
  | { type: "animate"; value: string }
  | { type: "hintLevel"; level: number }
  | { type: "celebrate" }
  | { type: "gotoTab"; tab: string }
  | { type: "showExample"; str: string; accept: boolean };

const TAG = /<IALE_([A-Z_]+)([^>]*)\/>/g;

function attrs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

export function parseTutorActions(text: string): { cleanText: string; actions: TutorAction[] } {
  const actions: TutorAction[] = [];
  const cleanText = text
    .replace(TAG, (_full, tag: string, rest: string) => {
      const a = attrs(rest);
      switch (tag) {
        case "HIGHLIGHT_STATE":
          if (a.state)
            actions.push({
              type: "highlight",
              state: a.state,
              color: (["blue", "rose", "cyan", "amber"].includes(a.color) ? a.color : "blue") as "blue",
            });
          break;
        case "TEST_STRING":
          if (a.value !== undefined) actions.push({ type: "test", value: a.value });
          break;
        case "ANIMATE_TRACE":
          if (a.value !== undefined) actions.push({ type: "animate", value: a.value });
          break;
        case "SET_HINT_LEVEL":
          actions.push({ type: "hintLevel", level: Math.min(3, Math.max(1, Number(a.level) || 1)) });
          break;
        case "CELEBRATE":
          actions.push({ type: "celebrate" });
          break;
        case "GOTO_TAB":
          if (a.tab) actions.push({ type: "gotoTab", tab: a.tab });
          break;
        case "SHOW_EXAMPLE":
          if (a.str !== undefined) actions.push({ type: "showExample", str: a.str, accept: a.accept !== "false" });
          break;
      }
      return "";
    })
    .trim();
  return { cleanText, actions: actions.slice(0, 2) };
}

export function dispatchTutorActions(actions: TutorAction[]) {
  if (typeof window === "undefined") return;
  for (const action of actions) window.dispatchEvent(new CustomEvent("iale-tutor-action", { detail: action }));
}

export function useTutorActionsEffect() {
  return null;
}
