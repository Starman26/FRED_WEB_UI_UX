import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Code2, FileText, Frame, Sparkles } from "lucide-react";

function clampPct(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function CodeEditor({
  fileName,
  onFileNameChange,
  value,
  onChange,
  readOnly = false,
}: {
  fileName: string;
  onFileNameChange?: (next: string) => void;
  value: string;
  onChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const lines = useMemo(() => {
    const arr = (value ?? "").split("\n");
    return arr.length ? arr : [""];
  }, [value]);

  const isEmpty = (value ?? "").length === 0;

  return (
    <div className="dash_codeRoot">
      <div className="dash_codeHeader">
        <input
          className="dash_codeFileInput"
          value={fileName}
          onChange={(e) => onFileNameChange?.(e.target.value)}
          placeholder="untitled"
          spellCheck={false}
        />
        {readOnly ? <div className="dash_codeBadge">Read only</div> : null}
      </div>

      <div className="dash_codeScroll">
        <div className="dash_codeGutter" ref={gutterRef} aria-hidden="true">
          {lines.map((_, i) => (
            <div key={i} className="dash_codeLineNum">
              {i + 1}
            </div>
          ))}
        </div>

        <div className="dash_codeEditorWrap">
          {isEmpty && !isFocused ? (
            <div className="dash_codeNoCodeYet">No code yet</div>
          ) : null}

          <textarea
            className="dash_codeTextarea"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            readOnly={readOnly}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            placeholder="No code yet"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onScroll={(e) => {
              if (gutterRef.current) {
                gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

type ActiveTab = "flow" | "code" | "doc";

export default function CodeEditorPanel({
  onBack,
  backLabel = "Back to dashboard",

  onFrame,
  onCode,
  onDoc,
  activeTab = "code",

  //  extra icon (new)
  onExtra,
  extraLabel = "More",

  //  progress (same as flow)
  progress = 0,
  progressLabel = "Practice Progress",

  fileName,
  onFileNameChange,
  code,
  onCodeChange,
  readOnly = false,
}: {
  onBack?: () => void;
  backLabel?: string;

  onFrame?: () => void;
  onCode?: () => void;
  onDoc?: () => void;
  activeTab?: ActiveTab;

  onExtra?: () => void;
  extraLabel?: string;

  progress?: number;
  progressLabel?: string;

  fileName: string;
  onFileNameChange?: (next: string) => void;

  code: string;
  onCodeChange?: (next: string) => void;
  readOnly?: boolean;
}) {
  const frameDisabled = !onFrame && activeTab !== "flow";
  const codeDisabled = !onCode && activeTab !== "code";
  const docDisabled = !onDoc && activeTab !== "doc";
  const extraDisabled = !onExtra;

  const pct = clampPct(progress);

  return (
    <div className="dash_flowRoot dash_flowRootRail dash_codePanel">
      {/* ===== CANVAS ===== */}
      <div className="dash_flowCanvas" aria-label="Code editor">
        <div className="dash_flowCanvasInner dash_codeCanvasInner">
          <CodeEditor
            fileName={fileName}
            onFileNameChange={onFileNameChange}
            value={code}
            onChange={onCodeChange}
            readOnly={readOnly}
          />
        </div>

        {/*  PROGRESS ABAJO (dentro del canvas) */}
        <div className="dash_flowBottomProgress" aria-label="Practice progress">
          <div className="dash_flowBottomProgressLabel">{progressLabel}</div>

          <div className="dash_flowBottomProgressRight">
            <div className="dash_flowBottomProgressPct">{pct}%</div>

            <div
              className="dash_flowBottomProgressBar"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            >
              <div
                className="dash_flowBottomProgressFill"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ===== RIGHT ICON RAIL ===== */}
      <div className="dash_flowRail" aria-label="Code actions">
        {/* Back (solo icono) */}
        <button
          type="button"
          onClick={onBack}
          className="dash_flowRailBtn"
          disabled={!onBack}
          aria-label={backLabel}
          title={backLabel}
        >
          <ArrowLeft className="dash_flowIcon" />
        </button>

        <div className="dash_flowRailDivider" />

        {/* Frame */}
        <button
          type="button"
          className={`dash_flowRailBtn ${
            activeTab === "flow" ? "dash_flowRailBtnActive" : ""
          }`}
          onClick={onFrame}
          disabled={frameDisabled}
          aria-label="Open frame"
          title={
            activeTab === "flow"
              ? "Frame"
              : onFrame
              ? "Open frame"
              : "Missing onFrame handler"
          }
        >
          <Frame className="dash_flowIcon" />
        </button>

        {/* Code */}
        <button
          type="button"
          className={`dash_flowRailBtn ${
            activeTab === "code" ? "dash_flowRailBtnActive" : ""
          }`}
          onClick={onCode}
          disabled={codeDisabled}
          aria-label="Open code"
          title={
            activeTab === "code"
              ? "Code"
              : onCode
              ? "Open code"
              : "Missing onCode handler"
          }
        >
          <Code2 className="dash_flowIcon" />
        </button>

        {/* Doc */}
        <button
          type="button"
          className={`dash_flowRailBtn ${
            activeTab === "doc" ? "dash_flowRailBtnActive" : ""
          }`}
          onClick={onDoc}
          disabled={docDisabled}
          aria-label="Open document"
          title={
            activeTab === "doc"
              ? "Document"
              : onDoc
              ? "Open document"
              : "Missing onDoc handler"
          }
        >
          <FileText className="dash_flowIcon" />
        </button>

        {/*  Extra icon (new) */}
        <div className="dash_flowRailSpacer" />

        <button
          type="button"
          className="dash_flowRailBtn"
          onClick={onExtra}
          disabled={extraDisabled}
          aria-label={extraLabel}
          title={extraLabel}
        >
          <Sparkles className="dash_flowIcon" />
        </button>
      </div>
    </div>
  );
}
