import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Frame, PenLine } from "lucide-react";

/* =========================================================
   Types
   ========================================================= */

export type AgentMeta = {
  key: string;
  title: string;
  role: string;
  bestAt: string[];
  lab?: string;
  icon: string;
};

export type Agent = {
  id: string;
  metaKey: string;
  radius: number;
  speed: number;
  phase: number;
  size: number;
  hit: number;
  ringOpacity: number;
};

export type ClockParts = { date: string; time: string };

/* =========================================================
   Agent catalog
   ========================================================= */

export const AGENT_META_CATALOG: AgentMeta[] = [
  { key: "cora", title: "CORA", role: "Operational Research Assistant", bestAt: ["Research", "general questions", "tracking"], lab: "FRED", icon: "CR" },
  { key: "lab_ops", title: "LAB OPS", role: "Lab Workflow Assistant", bestAt: ["SOPs", "protocol guidance", "checklists"], lab: "FRED", icon: "LO" },
  { key: "vision", title: "VISION", role: "Computer Vision Assistant", bestAt: ["segmentation", "planogram checks", "dataset triage"], lab: "FRED", icon: "VS" },
  { key: "iot", title: "IOT", role: "Automation & Sensors Assistant", bestAt: ["Arduino", "telemetry", "dashboards"], lab: "FRED", icon: "IT" },
  { key: "docs", title: "DOCS", role: "Documentation Assistant", bestAt: ["summaries", "technical writing", "requirements"], lab: "FRED", icon: "DC" },
  { key: "pm", title: "PM", role: "Project Tracking Assistant", bestAt: ["deadlines", "tasks", "status updates"], lab: "FRED", icon: "PM" },
];

export const META_BY_KEY: Record<string, AgentMeta> = AGENT_META_CATALOG.reduce((acc, m) => {
  acc[m.key] = m;
  return acc;
}, {} as Record<string, AgentMeta>);

/* =========================================================
   Small helpers
   ========================================================= */

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
      <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function isEditableTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as any).isContentEditable) return true;
  return false;
}

function easeInOutQuad(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/* =========================================================
   Info card
   ========================================================= */

function OrbitInfoCard({
  bodyRef,
  agent,
  anchor,
  onClose,
  onStartTalk,
}: {
  bodyRef: React.RefObject<HTMLDivElement>;
  agent: AgentMeta | null;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onStartTalk: (agent: AgentMeta) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(220);

  useLayoutEffect(() => {
    if (!cardRef.current) return;
    setCardH(cardRef.current.getBoundingClientRect().height);
  }, [agent]);

  if (!agent || !anchor) return null;

  const host = bodyRef.current;
  const bodyW = host?.clientWidth ?? 0;
  const bodyH = host?.clientHeight ?? 0;

  const CARD_W = 310;
  const M = 12;
  const GAP = 18;

  const rightX = anchor.x + GAP;
  const leftX = anchor.x - GAP - CARD_W;

  const fitsRight = rightX + CARD_W <= bodyW - M;
  const fitsLeft = leftX >= M;

  const cardX = fitsRight ? rightX : fitsLeft ? leftX : clamp(rightX, M, bodyW - M - CARD_W);
  const cardY = clamp(anchor.y - cardH * 0.35, M + 8, bodyH - M - cardH);

  const endX = fitsRight ? cardX : cardX + CARD_W;
  const endY = clamp(anchor.y, cardY + 22, cardY + cardH - 22);

  const midX = (anchor.x + endX) / 2;
  const pathD = `M ${anchor.x} ${anchor.y} C ${midX} ${anchor.y}, ${midX} ${endY}, ${endX} ${endY}`;

  return (
    <div className="dash_tipLayer" onClick={(e) => e.stopPropagation()}>
      <svg className="dash_tipSvg" aria-hidden="true">
        <path d={pathD} stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" fill="none" />
        <circle cx={anchor.x} cy={anchor.y} r="3" fill="rgba(255,255,255,0.55)" />
      </svg>

      <div
        ref={cardRef}
        className="dash_tipCard"
        style={{ left: cardX, top: cardY }}
        role="dialog"
        aria-label="More info"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="dash_tipClose" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              color: "rgba(255,255,255,0.9)",
              fontWeight: 800,
            }}
          >
            {agent.icon}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>{agent.title}</div>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(64,255,160,0.95)",
                  boxShadow: "0 0 12px rgba(64,255,160,0.35)",
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{agent.role}</div>
          </div>
        </div>

        <div style={{ height: 1, background: "rgba(255,255,255,0.10)", margin: "10px 0" }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 1.1,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
            }}
          >
            Best at
          </div>

          {agent.bestAt.map((skill, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ opacity: 0.6 }}>
                <ChevronRightIcon />
              </span>
              <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 13 }}>{skill}</span>
            </div>
          ))}
        </div>

        <button type="button" className="dash_tipBtn" onClick={() => onStartTalk(agent)}>
          <PenLine size={16} />
          Launch
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   Orbit system
   ========================================================= */

export default function OrbitSystem({
  bodyRef,
  agents,
  speedMult,
  bgTextureUrl,
  clockParts,
  currentLabLabel,
  defaultPrompt,
  hoverPrompt,
  agentPrompt,
  onSelectAgentKey,
  onStartTalk,
  onOpenFlow,
  showPager = true,
}: {
  bodyRef: React.RefObject<HTMLDivElement>;
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
  showPager?: boolean;
}) {
  const [hoverBall, setHoverBall] = useState<string | null>(null);
  const [activeBall, setActiveBall] = useState<string | null>(null);
  const [tipAnchor, setTipAnchor] = useState<{ x: number; y: number } | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  /* Internal pager state (used only when showPager = true) */
  const PAGER_COUNT = 6;
  const [selectedBody, setSelectedBody] = useState(0);

  /* =========================================================
     Meteor (demo notification)
     ========================================================= */
  const METEOR_MS = 2400;
  const [meteorVisible, setMeteorVisible] = useState(false);
  const meteorElRef = useRef<HTMLDivElement | null>(null);
  const meteorRafRef = useRef<number | null>(null);
  const meteorVisibleRef = useRef(false);

  useEffect(() => {
    meteorVisibleRef.current = meteorVisible;
  }, [meteorVisible]);

  const activeAgentMeta = useMemo(() => {
    if (!activeBall) return null;
    const a = agents.find((x) => x.id === activeBall);
    if (!a) return null;
    return META_BY_KEY[a.metaKey] ?? META_BY_KEY["cora"];
  }, [activeBall, agents]);

  const promptText = hoverBall ? hoverPrompt : agentPrompt ?? defaultPrompt;

  const closeTip = useCallback(() => {
    setActiveBall(null);
    setTipAnchor(null);
  }, []);

  /* =========================================================
     Typing detection (pause orbits)
     ========================================================= */
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (isEditableTarget(e.target)) setIsTyping(true);
    };
    const onFocusOut = () => window.setTimeout(() => setIsTyping(false), 0);

    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    return () => {
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const pausedOrbits = Boolean(hoverBall || activeBall || isTyping);

  /* =========================================================
     Orbit + pupil (single RAF, 30fps)
     ========================================================= */
  const ORBIT_STAGE = 860;
  const ORBIT_CX = ORBIT_STAGE / 2;
  const ORBIT_CY = ORBIT_STAGE / 2;

  const agentsRef = useRef<Agent[]>(agents);
  const speedRef = useRef<number>(speedMult);
  const pausedRef = useRef<boolean>(pausedOrbits);
  const tRef = useRef<number>(0);
  const lastRef = useRef<number | null>(null);
  const visPausedRef = useRef<boolean>(false);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    speedRef.current = speedMult;
  }, [speedMult]);

  useEffect(() => {
    pausedRef.current = pausedOrbits;
  }, [pausedOrbits]);

  useEffect(() => {
    const onVis = () => {
      visPausedRef.current = document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);
    onVis();
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const ballRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pupilRef = useRef<HTMLDivElement | null>(null);
  const pupilPosRef = useRef({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });

  /* =========================================================
     Mouse -> pupil (disabled while meteor is visible)
     ========================================================= */
  useEffect(() => {
    const host = bodyRef.current;
    if (!host) return;

    const onMove = (e: PointerEvent) => {
      if (isTyping) return;
      if (meteorVisibleRef.current) return;

      const rect = host.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height * 0.55;

      const mx = e.clientX - rect.left - centerX;
      const my = e.clientY - rect.top - centerY;

      const maxRadius = 12;
      const dist = Math.sqrt(mx * mx + my * my);

      if (dist > maxRadius) {
        const ang = Math.atan2(my, mx);
        targetRef.current = { x: Math.cos(ang) * maxRadius, y: Math.sin(ang) * maxRadius };
      } else {
        targetRef.current = { x: mx, y: my };
      }
    };

    const onLeave = () => {
      if (meteorVisibleRef.current) return;
      targetRef.current = { x: 0, y: 0 };
    };

    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [bodyRef, isTyping]);

  /* =========================================================
     Meteor: curved trajectory + pupil follow
     ========================================================= */
  const triggerMeteor = useCallback(() => {
    const host = bodyRef.current;
    if (!host) return;
    if (meteorVisibleRef.current) return;

    if (meteorRafRef.current) {
      cancelAnimationFrame(meteorRafRef.current);
      meteorRafRef.current = null;
    }

    const rect = host.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;

    const startX = -80;
    const startY = H * (0.25 + Math.random() * 0.55);

    const endX = W + 140;
    const endY = H * (0.08 + Math.random() * 0.18);

    const curveAmp = -H * (0.10 + Math.random() * 0.06);

    const baseAngle = (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI;

    setMeteorVisible(true);
    meteorVisibleRef.current = true;

    if (meteorElRef.current) {
      meteorElRef.current.style.left = `${startX}px`;
      meteorElRef.current.style.top = `${startY}px`;
      meteorElRef.current.style.transform = `rotate(${baseAngle}deg)`;
    }

    const t0 = performance.now();

    const loop = (now: number) => {
      const elapsed = now - t0;
      const progress = Math.min(elapsed / METEOR_MS, 1);
      const eased = easeInOutQuad(progress);

      const x = startX + (endX - startX) * eased;

      const yLinear = startY + (endY - startY) * eased;
      const y = yLinear + curveAmp * Math.sin(Math.PI * eased);

      if (meteorElRef.current) {
        meteorElRef.current.style.left = `${x}px`;
        meteorElRef.current.style.top = `${y}px`;
        meteorElRef.current.style.transform = `rotate(${baseAngle}deg)`;
      }

      const maxRadius = 12;
      const centerX = W / 2;
      const centerY = H * 0.55;

      const dx = x - centerX;
      const dy = y - centerY;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxRadius) {
        const ang = Math.atan2(dy, dx);
        targetRef.current = { x: Math.cos(ang) * maxRadius, y: Math.sin(ang) * maxRadius };
      } else {
        targetRef.current = { x: dx, y: dy };
      }

      if (progress < 1) {
        meteorRafRef.current = requestAnimationFrame(loop);
      } else {
        setMeteorVisible(false);
        meteorVisibleRef.current = false;
        meteorRafRef.current = null;
        targetRef.current = { x: 0, y: 0 };
      }
    };

    meteorRafRef.current = requestAnimationFrame(loop);
  }, [bodyRef]);

  useEffect(() => {
    const id = window.setInterval(() => triggerMeteor(), 120_000);
    const first = window.setTimeout(() => triggerMeteor(), 1800);

    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
      if (meteorRafRef.current) cancelAnimationFrame(meteorRafRef.current);
    };
  }, [triggerMeteor]);

  /* =========================================================
     Main RAF (orbits + pupil)
     ========================================================= */
  useEffect(() => {
    let raf = 0;
    let lastPaint = 0;
    const FRAME_MS = 1000 / 30;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (visPausedRef.current) return;

      if (lastRef.current === null) lastRef.current = now;
      const dt = Math.min(40, now - lastRef.current);
      lastRef.current = now;

      if (now - lastPaint < FRAME_MS) return;
      lastPaint = now;

      if (!isTyping && pupilRef.current) {
        const prev = pupilPosRef.current;
        const next = {
          x: lerp(prev.x, targetRef.current.x, 0.18),
          y: lerp(prev.y, targetRef.current.y, 0.18),
        };
        pupilPosRef.current = next;
        pupilRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      }

      if (pausedRef.current) return;

      tRef.current += dt / 1000;
      const t = tRef.current;
      const sp = speedRef.current;

      for (const a of agentsRef.current) {
        const el = ballRefs.current[a.id];
        if (!el) continue;

        const ang = a.phase + t * a.speed * sp;
        const x = ORBIT_CX + Math.cos(ang) * a.radius;
        const y = ORBIT_CY + Math.sin(ang) * a.radius;

        const half = a.hit / 2;
        el.style.transform = `translate3d(${x - half}px, ${y - half}px, 0)`;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isTyping]);

  /* =========================================================
     Rings
     ========================================================= */
  const uniqueRings = useMemo(() => {
    const m = new Map<number, number>();
    for (const a of agents) {
      const key = Math.round(a.radius);
      m.set(key, Math.max(m.get(key) ?? 0, a.ringOpacity));
    }
    return Array.from(m.entries()).map(([radius, opacity]) => ({ radius, opacity }));
  }, [agents]);

  /* =========================================================
     Anchors + UI
     ========================================================= */
  const getAnchorFromEl = (el: HTMLElement) => {
    const host = bodyRef.current;
    if (!host) return null;

    const bodyRect = host.getBoundingClientRect();
    const r = el.getBoundingClientRect();

    return {
      x: r.left + r.width / 2 - bodyRect.left,
      y: r.top + r.height / 2 - bodyRect.top,
    };
  };

  const eyeShrink = hoverBall || activeBall ? "dash_eyeShrink" : "";

  return (
    <div style={{ position: "absolute", inset: 0 }} onClick={() => closeTip()}>
      {/* Internal body pager (optional). When Dashboard owns the pager, pass showPager={false}. */}
      {showPager && (
        <div className="dash_bodyPager" onClick={(e) => e.stopPropagation()} aria-label="Body selector">
          {Array.from({ length: PAGER_COUNT }).map((_, i) => (
            <button
              key={`pager_${i}`}
              type="button"
              className={["dash_pagerItem", i === selectedBody ? "dash_pagerItemActive" : ""].join(" ")}
              onClick={() => setSelectedBody(i)}
              aria-label={`Select body ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Frame icon */}
      <button
        type="button"
        className="dash_frameBtn"
        aria-label="Open flow state"
        title="Flow state"
        onClick={(e) => {
          e.stopPropagation();
          onOpenFlow?.();
        }}
      >
        <Frame size={18} />
      </button>

      <OrbitInfoCard bodyRef={bodyRef} agent={activeAgentMeta} anchor={tipAnchor} onClose={closeTip} onStartTalk={onStartTalk} />

      {/* Meteor */}
      {meteorVisible && (
        <div
          ref={meteorElRef}
          className="dash_rocket"
          style={{
            left: -200,
            top: -200,
            transform: "rotate(-45deg)",
          }}
          aria-hidden="true"
        >
          <div className="dash_meteorGlow" />
          <div className="dash_meteorHead" />
          <div className="dash_meteorTrail">
            <div className="dash_trailMain" />
            <div className="dash_trailSparks">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="dash_spark" style={{ animationDelay: `${i * 0.09}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="dash_statusBar dash_statusBar2H">
        <div className="dash_statusRow">
          <span className="dash_statusDate">{clockParts.date}</span>
        </div>

        <div className="dash_statusRow">
          {(() => {
            const [hh = "--", mm = "--"] = (clockParts.time || "").split(":");
            return (
              <span className="dash_statusTime">
                {hh}
                <span className="dash_statusBlink">:</span>
                {mm}
              </span>
            );
          })()}
          <span className="dash_statusDot">•</span>
          <span className="dash_statusLabId">{currentLabLabel || "—"}</span>
        </div>
      </div>

      {/* Eye */}
      <div className={`dash_eyeWrap ${eyeShrink}`}>
        <div className="dash_eyeBall">
          <div ref={pupilRef} className="dash_eyePupil" />
        </div>
      </div>

      {/* Prompt */}
      <div className="dash_bodyPrompt" aria-live="polite">
        <span className="dash_bodyPromptLabel">CORA:</span>{" "}
        <span className="dash_bodyPromptText">{promptText}</span>
        <span className="dash_bodyPromptCaret dash_caretIdle" />
      </div>

      {/* Orbit stage */}
      <div className="dash_orbitStage" style={{ width: ORBIT_STAGE, height: ORBIT_STAGE }}>
        <div className="dash_orbitRings">
          {uniqueRings.map((r) => (
            <div
              key={`ring_${r.radius}`}
              className="dash_orbitRing"
              style={{ width: r.radius * 2, height: r.radius * 2, opacity: r.opacity }}
            />
          ))}
        </div>

        {agents.map((a) => {
          const isHover = hoverBall === a.id;
          const isActive = activeBall === a.id;
          const isMini = a.size <= 8;

          return (
            <button
              key={a.id}
              ref={(el) => {
                ballRefs.current[a.id] = el;
              }}
              type="button"
              className={[
                "dash_orbitBall",
                isMini ? "dash_orbitBallSm" : "",
                isHover ? "dash_orbitBallHover" : "",
                isActive ? "dash_orbitBallActive" : "",
              ].join(" ")}
              style={{
                width: a.hit,
                height: a.hit,
                left: 0,
                top: 0,
                transform: `translate3d(${ORBIT_CX - a.hit / 2}px, ${ORBIT_CY - a.hit / 2}px, 0)`,
                willChange: "transform",
                background: "var(--ball-color)",
                zIndex: 12,
              }}
              onPointerEnter={() => setHoverBall(a.id)}
              onPointerLeave={() => setHoverBall((prev) => (prev === a.id ? null : prev))}
              onClick={(e) => {
                e.stopPropagation();
                const anchor = getAnchorFromEl(e.currentTarget);

                onSelectAgentKey(a.metaKey);

                if (activeBall === a.id) {
                  closeTip();
                  return;
                }
                setActiveBall(a.id);
                setTipAnchor(anchor);
              }}
              aria-label="Orbiting satellite"
            >
              {!isMini && a.hit !== a.size && <span className="dash_orbitBallInner" style={{ width: a.size, height: a.size }} />}
            </button>
          );
        })}
      </div>

      {/* Texture overlay */}
      <div
        className="dash_textureOverlay"
        aria-hidden="true"
        style={{ backgroundImage: `url(${bgTextureUrl})`, pointerEvents: "none" }}
      />
    </div>
  );
}
