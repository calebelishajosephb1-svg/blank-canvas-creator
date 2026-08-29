import { useEffect, useRef, useState } from "react";
import { askTutor } from "@/lib/tutor.functions";
import { parseTutorActions, dispatchTutorActions } from "@/lib/tutor/actions";
import { checkReply } from "@/lib/tutor/guard";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const GREETING =
  "I'm your lab tutor. I can see your canvas, but I'll never hand you the answer — ask me what your machine is doing, or say **give me a hint**.";

export function TutorPanel({
  open,
  onClose,
  moduleId,
  getContext,
}: {
  open: boolean;
  onClose: () => void;
  moduleId: string;
  getContext: () => string;
}) {
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages.filter((m) => m.content !== GREETING), { role: "user", content: text }];
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await askTutor({
        data: {
          moduleContext: getContext().slice(0, 6000),
          messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content.slice(0, 6000) })),
        },
      });
      if (!res.ok) {
        setMessages((m) => [...m, { role: "assistant", content: res.error }]);
        return;
      }
      const { cleanText, actions } = parseTutorActions(res.text);
      const guard = checkReply(cleanText, { moduleId });
      const shown = guard.allowed ? cleanText : guard.fallback;
      setMessages((m) => [...m, { role: "assistant", content: shown }]);
      if (guard.allowed) dispatchTutorActions(actions);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "The tutor is unreachable right now." }]);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <aside
      className="fixed right-0 top-0 z-50 flex h-[100dvh] w-[380px] max-w-full flex-col border-l"
      style={{ background: "var(--bg-panel)", borderColor: "var(--border-subtle)", boxShadow: "var(--shadow-panel)" }}
    >
      <header
        className="flex h-[60px] shrink-0 items-center justify-between px-4"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <div>
          <h2 className="text-sm font-semibold">IALE Tutor</h2>
          <p className="text-[11px]" style={{ color: "var(--ink-muted)" }}>
            Socratic · never reveals the answer
          </p>
        </div>
        <button className="btn-ghost" onClick={onClose} aria-label="Close tutor">
          ✕
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className="rounded-lab px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
            style={{
              background: m.role === "user" ? "var(--signal-blue-15)" : "var(--bg-panel-raised)",
              border: "1px solid var(--border-subtle)",
              marginLeft: m.role === "user" ? 28 : 0,
              marginRight: m.role === "user" ? 0 : 28,
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <p className="text-xs" style={{ color: "var(--ink-muted)" }}>
            Thinking…
          </p>
        )}
      </div>

      <div className="flex gap-2 p-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <input
          className="field-input flex-1"
          value={input}
          placeholder="Ask about your machine…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="btn-primary" onClick={() => void send()} disabled={sending}>
          Send
        </button>
      </div>
    </aside>
  );
}
