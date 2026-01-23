import React from "react";
import { ArrowLeft, Code2, FileText, Frame, Sparkles, Plus } from "lucide-react";

function AwaitingAnimation() {
  return (
    <div className="dash_awaitingRoot">
      <div className="dash_awaitingOrb" aria-hidden="true">
        <div className="dash_awaitingRing" />
        <div className="dash_awaitingDot" />
      </div>

      <p className="dash_awaitingText">Awaiting instructions, traveler</p>
    </div>
  );
}

type ActiveTab = "flow" | "code" | "doc";

function clampPct(v: number) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export default function ReasoningFlowPanel({
  onBack,
  backLabel = "Go back to dashboard",
  children,

  onCode,
  onDoc,
  onFrame,
  activeTab = "flow",

  // ✅ PLUS (solo flow panel)
  onPlus,
  plusLabel = "Add",

  // ✅ extra (bottom)
  onExtra,
  extraLabel = "Extra",

  // ✅ progress
  progress = 0,
  progressLabel = "Practice Progress",
}: {
  onBack?: () => void;
  backLabel?: string;
  children?: React.ReactNode;

  onCode?: () => void;
  onDoc?: () => void;
  onFrame?: () => void;
  activeTab?: ActiveTab;

  onPlus?: () => void;
  plusLabel?: string;

  onExtra?: () => void;
  extraLabel?: string;

  progress?: number;
  progressLabel?: string;
}) {
  const frameDisabled = !onFrame && activeTab !== "flow";
  const codeDisabled = !onCode && activeTab !== "code";
  const docDisabled = !onDoc && activeTab !== "doc";
  const plusDisabled = !onPlus;

  const extraDisabled = !onExtra;
  const pct = clampPct(progress);

  return (
    <div className="dash_flowRoot dash_flowRootRail">
      {/* ===== CANVAS ===== */}
      <div className="dash_flowCanvas" aria-label="Reasoning flow canvas">
        <div className="dash_flowCanvasInner">
          {children ? (
            children
          ) : (
            <div className="dash_flowEmpty">
              <AwaitingAnimation />
            </div>
          )}
        </div>

        {/* ✅ PROGRESS ABAJO */}
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
      <div className="dash_flowRail dash_flowRailWide" aria-label="Flow actions">
        {/* Back */}
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

        {/* Frame + PLUS (side-by-side) */}
        <div className="dash_flowRailRow" aria-label="Flow tools">
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

          <button
            type="button"
            className="dash_flowRailBtn"
            onClick={onPlus}
            disabled={plusDisabled}
            aria-label={plusLabel}
            title={plusLabel}
          >
            <Plus className="dash_flowIcon" />
          </button>
        </div>

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

        <div className="dash_flowRailSpacer" />

        {/* Extra bottom */}
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
