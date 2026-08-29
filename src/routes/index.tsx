import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Discovery } from "@/components/modules/Discovery";
import { MutationLab } from "@/components/modules/MutationLab";
import { Debugger } from "@/components/modules/Debugger";
import { Analytics } from "@/components/modules/Analytics";
import { NFALab } from "@/components/modules/NFALab";
import { TutorPanel } from "@/components/TutorPanel";
import { Storage, KEYS } from "@/lib/storage";
import { audioPulse } from "@/lib/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "IALE — Interactive Automata Learning Environment" },
      {
        name: "description",
        content:
          "Build DFAs by hand, test them against hidden languages, and learn from a Socratic tutor that never gives the answer away.",
      },
      { property: "og:title", content: "IALE — Interactive Automata Learning Environment" },
      {
        property: "og:description",
        content: "A midnight blueprint lab for building, debugging and minimizing deterministic finite automata.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "discovery", label: "Discovery" },
  { id: "mutation", label: "Mutation Lab" },
  { id: "debugger", label: "Debugger" },
  { id: "analytics", label: "Analytics" },
  { id: "nfa", label: "NFA Lab" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Index() {
  const [tab, setTab] = useState<TabId>("discovery");
  const [tutorOpen, setTutorOpen] = useState(false);
  const [theme, setTheme] = useState<"lab" | "overcast">("lab");
  const [audioOn, setAudioOn] = useState(false);
  const contexts = useRef<Record<string, () => string>>({});

  const register = useCallback(
    (id: string) => (fn: () => string) => {
      contexts.current[id] = fn;
    },
    [],
  );

  // URL-driven fresh start: ?reset=1 wipes every iale_* key before first paint.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "1" || params.get("fresh") === "1") {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith("iale_"))
        .forEach((k) => window.localStorage.removeItem(k));
      window.history.replaceState({}, "", window.location.pathname);
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    setAudioOn(audioPulse.hydrate());
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem(KEYS.THEME);
    if (saved === "overcast" || saved === "lab") setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme === "overcast" ? "overcast" : "lab");
    window.localStorage.setItem(KEYS.THEME, theme);
  }, [theme]);

  // Tutor can drive navigation.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { type?: string; tab?: string };
      if (detail?.type === "gotoTab" && detail.tab && TABS.some((t) => t.id === detail.tab))
        setTab(detail.tab as TabId);
    };
    window.addEventListener("iale-tutor-action", handler);
    return () => window.removeEventListener("iale-tutor-action", handler);
  }, []);

  function resetAll() {
    if (!window.confirm("Reset all saved machines, progress and analytics? This cannot be undone.")) return;
    Storage.clearAllData();
    window.location.reload();
  }

  const getContext = useCallback(() => contexts.current[tab]?.() ?? `Module: ${tab}`, [tab]);

  return (
    <div className="flex h-[100dvh] min-h-0 flex-1 flex-col">
      <header className="app-header">
        <div className="flex items-center gap-2 pr-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--signal-blue)", boxShadow: "0 0 10px var(--signal-blue)" }}
          />
          <h1 className="font-display text-base font-bold tracking-tight">IALE</h1>
        </div>

        <nav className="flex flex-1 flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} className="nav-tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <button className="btn-ghost" onClick={() => setTutorOpen((o) => !o)}>
            {tutorOpen ? "Hide tutor" : "Ask tutor"}
          </button>
          <button
            className="btn-ghost"
            title={audioOn ? "Mute pulse audio" : "Enable pulse audio"}
            aria-pressed={audioOn}
            onClick={() => {
              const next = !audioOn;
              audioPulse.setEnabled(next);
              setAudioOn(next);
              if (next) audioPulse.tick();
            }}
          >
            {audioOn ? "🔊" : "🔇"}
          </button>
          <button className="btn-ghost" onClick={() => setTheme(theme === "lab" ? "overcast" : "lab")}>
            {theme === "lab" ? "Overcast" : "Lab"}
          </button>
          <button className="btn-ghost" style={{ color: "var(--signal-rose)" }} onClick={resetAll}>
            Reset
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1" style={{ display: tab === "discovery" ? "flex" : "none" }}>
          <Discovery active={tab === "discovery"} onContext={register("discovery")} />
        </div>
        <div className="flex min-h-0 flex-1" style={{ display: tab === "mutation" ? "flex" : "none" }}>
          <MutationLab active={tab === "mutation"} onContext={register("mutation")} />
        </div>
        <div className="flex min-h-0 flex-1" style={{ display: tab === "debugger" ? "flex" : "none" }}>
          <Debugger active={tab === "debugger"} onContext={register("debugger")} />
        </div>
        <div className="flex min-h-0 flex-1" style={{ display: tab === "analytics" ? "flex" : "none" }}>
          <Analytics
            active={tab === "analytics"}
            onContext={register("analytics")}
            onGoto={(t) => setTab(t as TabId)}
          />
        </div>
        <div className="flex min-h-0 flex-1" style={{ display: tab === "nfa" ? "flex" : "none" }}>
          <NFALab />
        </div>
      </main>

      <TutorPanel open={tutorOpen} onClose={() => setTutorOpen(false)} moduleId={tab} getContext={getContext} />
      <Toaster />
    </div>
  );
}
