import type { ReactNode } from "react";
import type { CanvasMode } from "./DFACanvas";

const MODES: { mode: CanvasMode; key: string; label: string; title: string }[] = [
  { mode: "pointer", key: "V", label: "V", title: "Move / select (V)" },
  { mode: "state", key: "S", label: "S", title: "Add state (S)" },
  { mode: "transition", key: "T", label: "T", title: "Add transition (T)" },
  { mode: "delete", key: "D", label: "D", title: "Delete (D)" },
];

export function CanvasToolbar({
  mode,
  setMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onLayout,
  alphabet,
  children,
}: {
  mode: CanvasMode;
  setMode: (m: CanvasMode) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onClear?: () => void;
  onLayout?: () => void;
  alphabet?: string[];
  children?: ReactNode;
}) {
  return (
    <div className="canvas-toolbar">
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button key={m.mode} className="tool-btn" data-active={mode === m.mode} title={m.title} onClick={() => setMode(m.mode)}>
            {m.label}
          </button>
        ))}
      </div>
      <span className="mx-1 h-5 w-px" style={{ background: "var(--border-subtle)" }} />
      {onUndo && (
        <button className="tool-btn" onClick={onUndo} disabled={!canUndo} title="Undo">
          ↶
        </button>
      )}
      {onRedo && (
        <button className="tool-btn" onClick={onRedo} disabled={!canRedo} title="Redo">
          ↷
        </button>
      )}
      {onClear && (
        <button className="tool-btn" onClick={onClear} title="Clear canvas">
          Trash
        </button>
      )}
      {onLayout && (
        <button className="tool-btn" onClick={onLayout} title="Auto layout">
          Layout
        </button>
      )}
      {alphabet && (
        <span className="badge" data-tone="blue" style={{ fontFamily: "var(--font-mono-family)" }}>
          Σ = {"{"}
          {alphabet.join(",")}
          {"}"}
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
