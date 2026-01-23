import type { RefObject } from "react";
import type { Agent, AgentMeta, ClockParts } from "./OrbitSystem";

type Props = {
  bodyRef: RefObject<HTMLDivElement>;
  agents: Agent[];
  speedMult: number;
  bgTextureUrl: string;
  clockParts: ClockParts;
  currentLabLabel: string;
  defaultPrompt: string;
  hoverPrompt: string;
  agentPrompt: string | null;
  onSelectAgentKey: (metaKey: string) => void;
  onStartTalk: (agent: AgentMeta) => void;
  onOpenFlow?: () => void;
  variantIndex?: number;
};

export default function BodyVariant2(props: Props) {
  const { bodyRef } = props;

  return (
    <div
      ref={bodyRef}
      aria-label="Body variant 2"
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "var(--panel-bg)",
        backgroundImage:
          "radial-gradient(var(--panel-dot) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        backgroundPosition: "0 0",
      }}
    />
  );
}
