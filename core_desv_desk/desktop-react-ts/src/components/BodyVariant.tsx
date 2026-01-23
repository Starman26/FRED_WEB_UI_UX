// src/components/GreyBody.tsx  (o BodyVariant.tsx)
import { useMemo, useState } from "react";
import type { RefObject } from "react";
import { Plus, PenLine, X } from "lucide-react";

import {
  AGENT_META_CATALOG,
  META_BY_KEY,
  type Agent,
  type AgentMeta,
  type ClockParts,
} from "./OrbitSystem";

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
  onAddAgent?: (metaKey: string) => void;
  
};

const MAX_SATS = 6;

export default function GreyBody(props: Props) {
  const {
    agents,
    clockParts,
    currentLabLabel,
    onSelectAgentKey,
    onStartTalk,
    onAddAgent,
  } = props;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const canAdd = agents.length < MAX_SATS && Boolean(onAddAgent);

  const usedKeys = useMemo(() => new Set(agents.map((a) => a.metaKey)), [agents]);

  const availableMetas = useMemo(() => {
    return AGENT_META_CATALOG.filter((m) => !usedKeys.has(m.key));
  }, [usedKeys]);

  const slots = useMemo(() => Array.from({ length: MAX_SATS }), []);

  const handleSelect = (a: Agent) => {
    setActiveId(a.id);
    onSelectAgentKey(a.metaKey);
  };

  const handleLaunch = (a: Agent) => {
    const meta = META_BY_KEY[a.metaKey] ?? META_BY_KEY["cora"];
    onStartTalk(meta);
  };

  return (
    <div className="grey_bodyRoot" onClick={() => setAddOpen(false)}>
      <div
        className="grey_bodyInner"
        onClick={(e) => e.stopPropagation()}
        //  esto es lo que te baja TODO (header + tarjetas) para que se vea
        style={{ paddingTop: 100 }}
      >
        {/* Header con 2 textos */}
        <div className="grey_headerRow" style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div
              className="grey_title"
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,0.92)",
                textShadow: "0 1px 18px rgba(0,0,0,0.65)",
              }}
            >
              Latest<span className="grey_titleDots">...</span>
            </div>

            <div
              className="grey_subtitle"
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.62)",
                textShadow: "0 1px 18px rgba(0,0,0,0.65)",
              }}
            >
              More text
            </div>
          </div>

          <div className="grey_statusMini" aria-hidden="true">
            <span className="grey_statusMiniTime">{clockParts.time}</span>
            <span className="grey_statusMiniDot">•</span>
            <span className="grey_statusMiniLab">{currentLabLabel || "—"}</span>
          </div>
        </div>

        {/*  Grid más abajo del header */}
        <div className="grey_grid" style={{ marginTop: 22, position: "relative", zIndex: 1 }}>
          {slots.map((_, i) => {
            const a = agents[i];

            if (a) {
              const meta = META_BY_KEY[a.metaKey] ?? META_BY_KEY["cora"];
              const isActive = activeId === a.id;

              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={0}
                  className={["grey_card", isActive ? "grey_cardActive" : ""].join(" ")}
                  onClick={() => handleSelect(a)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelect(a);
                    }
                  }}
                >
                  <div className="grey_cardTop">
                    <div className="grey_badge" aria-hidden="true">{meta.icon}</div>

                    <div className="grey_cardText">
                      <div className="grey_nameRow">
                        <div className="grey_name">{meta.title}</div>
                        <span className={["grey_activeDot", isActive ? "isOn" : ""].join(" ")} />
                      </div>
                      <div className="grey_role" title={meta.role}>{meta.role}</div>
                    </div>
                  </div>

                  <div className="grey_bestRow" aria-label="Best at">
                    {meta.bestAt.slice(0, 3).map((t, idx) => (
                      <span key={idx} className="grey_chip">{t}</span>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="grey_launchBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunch(a);
                    }}
                  >
                    <PenLine size={16} />
                    Launch
                  </button>
                </div>
              );
            }

            const isAddSlot = i === agents.length;

            if (isAddSlot) {
              return (
                <button
                  key={`add_${i}`}
                  type="button"
                  className={["grey_card", "grey_cardAdd", canAdd ? "" : "grey_cardDisabled"].join(" ")}
                  onClick={() => {
                    if (!canAdd) return;
                    setAddOpen(true);
                  }}
                >
                  <div className="grey_addPlus" aria-hidden="true">
                    <Plus size={28} />
                  </div>
                </button>
              );
            }

            return <div key={`empty_${i}`} className="grey_card grey_cardEmpty" aria-hidden="true" />;
          })}
        </div>

        {addOpen && (
          <div className="grey_addOverlay" onClick={() => setAddOpen(false)} role="dialog">
            <div className="grey_addModal" onClick={(e) => e.stopPropagation()}>
              <div className="grey_addHeader">
                <div className="grey_addTitle">Add satellite</div>
                <button type="button" className="grey_addClose" onClick={() => setAddOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="grey_addHint">Elige uno. (Mismo set que Orbit. Máximo {MAX_SATS}.)</div>

              <div className="grey_addList">
                {availableMetas.length === 0 ? (
                  <div className="grey_addEmpty">Ya agregaste todos los perfiles disponibles.</div>
                ) : (
                  availableMetas.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      className="grey_addItem"
                      onClick={() => {
                        onAddAgent?.(m.key);
                        onSelectAgentKey(m.key);
                        setAddOpen(false);
                      }}
                    >
                      <div className="grey_addBadge" aria-hidden="true">{m.icon}</div>
                      <div className="grey_addInfo">
                        <div className="grey_addName">{m.title}</div>
                        <div className="grey_addRole">{m.role}</div>
                        <div className="grey_addBest">
                          {m.bestAt.slice(0, 3).map((t, idx) => (
                            <span key={idx} className="grey_chip">{t}</span>
                          ))}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/*  No prompt abajo */}
    </div>
  );
}
