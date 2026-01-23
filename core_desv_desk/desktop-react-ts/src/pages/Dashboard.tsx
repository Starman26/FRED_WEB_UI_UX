// src/pages/Dashboard.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback} from "react";
import { Panel, Group, Separator } from "react-resizable-panels";
import "../styles/dashboard-ui.css";
import { Menu } from "lucide-react";

import Chat from "./Chat";
import ReasoningFlowPanel from "../components/ReasoningFlowPanel";
import CodeEditorPanel from "../components/CodeEditorPanel";

import OrbitSystem, {
  META_BY_KEY,
  type Agent,
  type AgentMeta,
  type ClockParts,
  AGENT_META_CATALOG,
} from "../components/OrbitSystem";

import BodyVariant from "../components/BodyVariant";
import BodyVariant2 from "../components/BodyVariant2";
import BodyVariant3 from "../components/BodyVariant3";

import { supabase } from "../lib/supabaseClient";
import bgTexture from "../assets/Bg.png";
const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";

const MAX_ORBITS = 6;
const SPEED_MULT = 0.45;

const BODY_COUNT = 4;
const BODY_STORAGE_KEY = "dash.selectedBody";

type LabTeam = {
  id: string;
  name: string | null;
  code: string | null;
};

type Notification = {
  id: string;
  title: string;
  when: string;
  unread?: boolean;
};

type CurrentWork =
  | {
      title: string;
      route?: string;
    }
  | null;

interface DashboardHeaderProps {
  userName: string;
  userError?: string | null;
  satelliteCount: number;
  maxSatellites: number;
  onAddSatellite: () => void;
  currentWork: CurrentWork;
  notifications: Notification[];
}
function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `a_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function clampInt(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, Math.floor(n)));
}

async function loadUserName(user: any): Promise<string> {
  if (!user) return "";

  let baseName = user.email?.split("@")[0] ?? "";

  const { data, error } = await supabase
    .from("students")
    .select("full_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) return baseName;

  if (data?.full_name) {
    const parts = data.full_name.trim().split(/\s+/);
    baseName = parts[0] || baseName;
  }

  return baseName;
}

async function fetchUserLabs(
  user: any
): Promise<{
  labs: LabTeam[];
  activeLabId: string | null;
  error?: string;
}> {
  if (!user) return { labs: [], activeLabId: null };

  const { data: appRow, error: appErr } = await supabase
    .from("app_user")
    .select("id, team_id")
    .eq("id", user.id)
    .maybeSingle();

  if (appErr) {
    return {
      labs: [],
      activeLabId: null,
      error: "Error al cargar datos del usuario",
    };
  }

  if (!appRow?.team_id) {
    return { labs: [], activeLabId: null };
  }

  const { data: teamRows, error: teamErr } = await supabase
    .from("teams")
    .select("id, name, code")
    .eq("id", appRow.team_id);

  if (teamErr) {
    return {
      labs: [],
      activeLabId: null,
      error: "Error al cargar laboratorios",
    };
  }

  const labsData = (teamRows || []) as LabTeam[];

  return {
    labs: labsData,
    activeLabId: labsData.length > 0 ? labsData[0].id : null,
  };
}

function useOutsideClose(
  refs: React.RefObject<HTMLElement>[],
  onClose: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;

      for (const r of refs) {
        const el = r.current;
        if (el && el.contains(target)) return;
      }
      onClose();
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [enabled, onClose, refs]);
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transformOrigin: "50% 50%",
          transition: "transform 0.2s",
        }}
      />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
      <path
        d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 5H12.5C13.33 5 14 5.67 14 6.5V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function SatellitesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <circle cx="14" cy="5" r="1.5" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" opacity="0.6" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M13.5 6.75C13.5 5.55653 13.0259 4.41193 12.182 3.56802C11.3381 2.72411 10.1935 2.25 9 2.25C7.80653 2.25 6.66193 2.72411 5.81802 3.56802C4.97411 4.41193 4.5 5.55653 4.5 6.75C4.5 12 2.25 13.5 2.25 13.5H15.75C15.75 13.5 13.5 12 13.5 6.75Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.2975 15.75C10.1657 15.9773 9.9764 16.166 9.74868 16.2971C9.52097 16.4283 9.26278 16.4973 9 16.4973C8.73722 16.4973 8.47903 16.4283 8.25132 16.2971C8.0236 16.166 7.83434 15.9773 7.7025 15.75"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DashboardHeader({
  userName,
  userError,
  satelliteCount,
  maxSatellites,
  onAddSatellite,
  currentWork,
  notifications,
}: DashboardHeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (sidebarCollapsed) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
    else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;

      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {}

      if (next) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
      else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);

      window.dispatchEvent(new CustomEvent("cora:sidebar-toggle", { detail: { collapsed: next } }));

      return next;
    });
  }, []);

  const notifWrapRef = useRef<HTMLDivElement>(null);

  const closeAll = useCallback(() => {
    setNotifOpen(false);
  }, []);

  const outsideRefs = useMemo(() => [notifWrapRef], []);
  useOutsideClose(outsideRefs as any, closeAll, notifOpen);

  const notifCount = notifications.filter((n) => Boolean(n.unread)).length;
  const displayName = userName.trim() || "User";

  return (
    <header
      className="dash_topbar"
      style={{
        background: "var(--sb-bg)",
        borderBottom: "1px solid var(--sb-border)",
      }}
    >
      <div className="dash_topbarLeft">
        <button
          type="button"
          onClick={() => {
            toggleSidebar();
            setNotifOpen(false);
          }}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={sidebarCollapsed}
          style={{
            width: 34,
            height: 34,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            margin: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.92)",
          }}
        >
          <Menu size={18} />
        </button>

        <div className="dash_topbarDivider" />

        <div className="dash_userName">{displayName}</div>
        {userError ? <div className="dash_userError">({userError})</div> : null}
      </div>

      <div className="dash_topbarMid">
        <button
          type="button"
          className="dash_satBtn"
          onClick={onAddSatellite}
          disabled={satelliteCount >= maxSatellites}
          title={satelliteCount >= maxSatellites ? "Max satellites reached" : "Add satellite"}
        >
          <SatellitesIcon />
          <div className="dash_satDots">
            {Array.from({ length: maxSatellites }).map((_, i) => (
              <span key={i} className={`dash_satDot ${i < satelliteCount ? "dash_satDotOn" : ""}`} />
            ))}
          </div>
          <span style={{ fontWeight: 700, marginLeft: 2 }}>+</span>
        </button>
      </div>

      <div className="dash_topbarRight">
        <a
          className={`dash_workBtn ${currentWork ? "" : "dash_workBtnDisabled"}`}
          href={currentWork?.route || "#"}
          onClick={(e) => {
            if (!currentWork) e.preventDefault();
            setNotifOpen(false);
          }}
        >
          <FolderIcon />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11, opacity: 0.65 }}>Continuar</span>
            <span className="dash_workText">
              {currentWork ? currentWork.title : "You don't have current works"}
            </span>
          </div>
          <span className="dash_iconChevron">
            <ChevronIcon open={false} />
          </span>
        </a>

        <div className="dash_notifWrap" ref={notifWrapRef}>
          <button
            type="button"
            className={`dash_notifBtn ${notifOpen ? "dash_notifBtnOpen" : ""}`}
            onClick={() => setNotifOpen((v) => !v)}
            aria-label="Notifications"
          >
            <BellIcon />
            {notifCount > 0 ? <span className="dash_badge">{notifCount}</span> : null}
          </button>

          {notifOpen && (
            <div className="dash_dropCard dash_notifDrop">
              <div className="dash_notifTitle">Notificaciones</div>

              <div className="dash_notifList">
                {notifications.length === 0 ? (
                  <div className="dash_notifEmpty">You don't have any notifications</div>
                ) : (
                  notifications.slice(0, 6).map((n) => (
                    <div key={n.id} className="dash_notifRow">
                      <span className="dash_notifDot" />
                      <div className="dash_notifText">
                        <div className="dash_notifRowTitle">{n.title}</div>
                        <div className="dash_notifRowWhen">{n.when}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="dash_notifFooter" type="button" disabled>
                Ver todas
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatPartsFromDate(d: Date): ClockParts {
  const date = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { date, time };
}

function parseClockStringToParts(s: string): ClockParts | null {
  const txt = (s || "").trim();

  const m = txt.match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4}).*?(\d{1,2}):(\d{2})/);
  if (m) {
    const dd = pad2(Number(m[1]));
    const mm = pad2(Number(m[2]));
    let yyyy = m[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    const hh = pad2(Number(m[4]));
    const mi = pad2(Number(m[5]));
    return { date: `${dd}.${mm}.${yyyy}`, time: `${hh}:${mi}` };
  }

  const d = new Date(txt);
  if (!Number.isNaN(d.getTime())) return formatPartsFromDate(d);

  return null;
}

async function getClockFromPythonIfAvailable(): Promise<string | null> {
  try {
    const api = (window as any).electronAPI;
    if (api?.getClock) {
      const s = await api.getClock();
      if (typeof s === "string" && s.trim().length > 0) return s;
    }
  } catch {}
  return null;
}

function SelectedAgentHeader({ agent }: { agent: AgentMeta }) {
  return (
    <div
      className="dash_selectedAgentHeader"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px" }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          fontWeight: 800,
          letterSpacing: 0.5,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {agent.icon}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 13,
            color: "rgba(255,255,255,0.92)",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.title}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.62)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {agent.role}
        </div>
      </div>

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
  );
}

function BodyPager({
  selected,
  onSelect,
  count = BODY_COUNT,
}: {
  selected: number;
  onSelect: (i: number) => void;
  count?: number;
}) {
  const GAP = 28;
  const DOT = 8;
  const HIT = 28;

  const LINE_W = 2;
  const LINE_H = 22;

  const thumbRef = useRef<HTMLDivElement>(null);
  const prevYRef = useRef<number>(selected * GAP);

  useEffect(() => {
    const el = thumbRef.current;
    const toY = selected * GAP;
    const fromY = prevYRef.current;

    if (el) {
      try {
        el.animate(
          [
            { transform: `translateY(${fromY}px)` },
            { transform: `translateY(${toY}px)` },
          ],
          {
            duration: 220,
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
            fill: "forwards",
          }
        );
      } catch {}
      el.style.transform = `translateY(${toY}px)`;
    }

    prevYRef.current = toY;
  }, [selected]);

  const railH = (count - 1) * GAP + LINE_H;

  return (
    <div
      className="dash_bodyPager"
      onClick={(e) => e.stopPropagation()}
      aria-label="Body selector"
    >
      <div
        style={{
          position: "relative",
          width: Math.max(HIT, 32),
          height: railH,
          display: "grid",
          placeItems: "center",
          pointerEvents: "auto",
        }}
      >
        <div
          ref={thumbRef}
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            marginLeft: -LINE_W / 2,
            width: LINE_W,
            height: LINE_H,
            borderRadius: 999,
            background: "rgba(255,255,255,0.45)",
            transform: `translateY(${selected * GAP}px)`,
            pointerEvents: "none",
          }}
        />

        {Array.from({ length: count }).map((_, i) => {
          const y = i * GAP + LINE_H / 2;
          const isActive = i === selected;

          return (
            <button
              key={`pager_${i}`}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={`Select body ${i + 1}`}
              style={{
                position: "absolute",
                left: "50%",
                top: y,
                transform: "translate(-50%, -50%)",
                width: HIT,
                height: HIT,
                borderRadius: 999,
                background: "transparent",
                border: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                outline: "none",
                boxShadow: "none",
                filter: "none",
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {isActive ? null : (
                <span
                  aria-hidden="true"
                  style={{
                    width: DOT,
                    height: DOT,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.22)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: "none",
                    filter: "none",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}


type FlowView = "reasoning" | "code";

export default function Dashboard() {
  const HOVER_PROMPT = "Ouh what a nice choice";

  const [selectedAgentKey, setSelectedAgentKey] = useState<string>("cora");
  const selectedAgentMeta = useMemo(() => {
    return META_BY_KEY[selectedAgentKey] ?? META_BY_KEY["cora"];
  }, [selectedAgentKey]);

  const [userName, setUserName] = useState<string>("");
  const [currentLab, setCurrentLab] = useState<string>("");
  const [userLoadError, setUserLoadError] = useState<string | null>(null);

  const displayName = (userName || "").trim();
  const DEFAULT_PROMPT = displayName ? `Welcome  ${displayName}` : "Welcome traveler, should we start?";

  const [orbitCountFromDb] = useState<number>(1);

  const [clockParts, setClockParts] = useState<ClockParts>(() => formatPartsFromDate(new Date()));

  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);

  const [currentWork] = useState<CurrentWork>(null);
  const [notifications] = useState<Notification[]>([]);

  const [flowMode, setFlowMode] = useState(false);
  const [flowView, setFlowView] = useState<FlowView>("reasoning");
  const flowUserDismissedRef = useRef(false);

  const bodyRef = useRef<HTMLDivElement>(null);

  const [codeFileName, setCodeFileName] = useState<string>("scratch.tsx");
  const [codeText, setCodeText] = useState<string>("");

  const [selectedBody, setSelectedBody] = useState<number>(() => {
    const raw = window.localStorage.getItem(BODY_STORAGE_KEY);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) ? clampInt(n, 0, BODY_COUNT - 1) : 0;
  });

  const selectBody = useCallback((i: number) => {
    const next = clampInt(i, 0, BODY_COUNT - 1);
    setSelectedBody(next);
    window.localStorage.setItem(BODY_STORAGE_KEY, String(next));
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      setUserLoadError(null);

      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      if (error) {
        setUserLoadError("No se pudo leer el usuario");
        return;
      }

      const user = data?.user;
      if (!user) {
        setUserLoadError("Usuario no autenticado");
        return;
      }

      try {
        const name = await loadUserName(user);
        if (!alive) return;
        setUserName(name);
      } catch {}

      try {
        const res = await fetchUserLabs(user);
        if (!alive) return;

        if (res.error) setUserLoadError(res.error);


        const active = res.labs.find((l) => l.id === res.activeLabId) ?? res.labs[0];
        const label = (active?.code || active?.name || "").toString();
        setCurrentLab(label);
      } catch {
        if (!alive) return;
        setUserLoadError("Error al cargar laboratorios");
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, []);

  const [agents, setAgents] = useState<Agent[]>(() => [
    {
      id: "b1",
      metaKey: "cora",
      radius: 360,
      speed: 0.55,
      phase: 0.2,
      size: 38,
      hit: 44,
      ringOpacity: 0.55,
    },
  ]);

  const orbitCountClamp = (n: number) => Math.max(1, Math.min(MAX_ORBITS, Math.floor(n || 1)));

  const ensureAgentCount = useCallback((targetCount: number) => {
    setAgents((prev) => {
      const next = [...prev];

      if (next.length > targetCount) return next.slice(0, targetCount);

      if (next.length < targetCount) {
        for (let i = next.length; i < targetCount; i++) {
          const radiusSlots = [360, 310, 270, 230, 200, 170];
          const sizeSlots = [38, 32, 26, 20, 14, 10];

          const radius = radiusSlots[i % radiusSlots.length];
          const size = sizeSlots[i % sizeSlots.length];
          const hit = Math.max(size + 8, 18);

          const speed = 0.55 + (i % 8) * 0.12;
          const phase = Math.random() * Math.PI * 2;
          const ringOpacity = Math.max(0.1, 0.55 - i * 0.03);

          const metaKey = AGENT_META_CATALOG[i]?.key ?? "cora";

          next.push({
            id: makeId(),
            metaKey,
            radius,
            speed,
            phase,
            size,
            hit,
            ringOpacity,
          });
        }
      }

      return next;
    });
  }, []);

  useEffect(() => {
    ensureAgentCount(orbitCountClamp(orbitCountFromDb));
  }, [ensureAgentCount, orbitCountFromDb]);

  const addSatelliteByKey = useCallback((metaKey: string) => {
    setAgents((prev) => {
      if (prev.length >= MAX_ORBITS) return prev;

      const i = prev.length;
      const radiusSlots = [360, 310, 270, 230, 200, 170];
      const sizeSlots = [38, 32, 26, 20, 14, 10];

      const radius = radiusSlots[i % radiusSlots.length];
      const size = sizeSlots[i % sizeSlots.length];
      const hit = Math.max(size + 8, 18);

      const speed = 0.55 + (i % 8) * 0.12;
      const phase = Math.random() * Math.PI * 2;
      const ringOpacity = Math.max(0.1, 0.55 - i * 0.03);

      return [...prev, { id: makeId(), metaKey, radius, speed, phase, size, hit, ringOpacity }];
    });
  }, []);

  const addSatellite = useCallback(() => {
    setAgents((prev) => {
      if (prev.length >= MAX_ORBITS) return prev;

      const used = new Set(prev.map((a) => a.metaKey));
      const nextKey = AGENT_META_CATALOG.find((m) => !used.has(m.key))?.key ?? "cora";

      const i = prev.length;
      const radiusSlots = [360, 310, 270, 230, 200, 170];
      const sizeSlots = [38, 32, 26, 20, 14, 10];

      const radius = radiusSlots[i % radiusSlots.length];
      const size = sizeSlots[i % sizeSlots.length];
      const hit = Math.max(size + 8, 18);

      const speed = 0.55 + (i % 8) * 0.12;
      const phase = Math.random() * Math.PI * 2;
      const ringOpacity = Math.max(0.1, 0.55 - i * 0.03);

      return [
        ...prev,
        { id: makeId(), metaKey: nextKey, radius, speed, phase, size, hit, ringOpacity },
      ];
    });
  }, []);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      const fromPy = await getClockFromPythonIfAvailable();
      if (!alive) return;

      if (fromPy) {
        const parsed = parseClockStringToParts(fromPy);
        if (parsed) setClockParts(parsed);
        else setClockParts(formatPartsFromDate(new Date()));
      } else {
        setClockParts(formatPartsFromDate(new Date()));
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const handleStartTalk = (_agent: AgentMeta) => {
    setAgentPrompt("Let's work!");
  };

  const RIGHT_DEFAULT_PX = 300;
  const RIGHT_MIN_PX = 300;
  const RIGHT_MAX_PX = 600;

  const goToDashboard = useCallback(() => {
    flowUserDismissedRef.current = true;
    setFlowMode(false);
    setFlowView("reasoning");
  }, []);

  const openFlowReasoning = useCallback(() => {
    flowUserDismissedRef.current = false;
    setFlowView("reasoning");
    setFlowMode(true);
  }, []);

  const openFlowCode = useCallback(() => {
    flowUserDismissedRef.current = false;
    setFlowView("code");
    setFlowMode(true);
  }, []);

  return (
    <div className="dash_root">
      <div className="dash_base">
        <div className="dash_left">
        <DashboardHeader
          userName={userName}
          userError={userLoadError}
          satelliteCount={agents.length}
          maxSatellites={MAX_ORBITS}
          onAddSatellite={addSatellite}
          currentWork={currentWork}
          notifications={notifications}
        />

          <div
            ref={bodyRef}
            className={["dash_body", !flowMode && selectedBody === 0 ? "dash_bodyOrbit" : ""].join(
              " "
            )}
          >
            {!flowMode && selectedBody === 0 && (
              <div className="dash_textureOverlay" style={{ backgroundImage: `url(${bgTexture})` }} />
            )}

            {!flowMode && <BodyPager selected={selectedBody} onSelect={selectBody} />}

            {flowMode ? (
              flowView === "code" ? (
                <CodeEditorPanel
                  onBack={goToDashboard}
                  backLabel="Go to dashboard"
                  activeTab="code"
                  onFrame={openFlowReasoning}
                  onCode={openFlowCode}
                  onDoc={undefined}
                  fileName={codeFileName}
                  onFileNameChange={setCodeFileName}
                  code={codeText}
                  onCodeChange={setCodeText}
                  readOnly={false}
                />
              ) : (
                <ReasoningFlowPanel
                  onBack={goToDashboard}
                  backLabel="Go to dashboard"
                  activeTab="flow"
                  onFrame={openFlowReasoning}
                  onCode={openFlowCode}
                  onDoc={undefined}
                />
              )
            ) : selectedBody === 0 ? (
              <OrbitSystem
                bodyRef={bodyRef}
                agents={agents}
                speedMult={SPEED_MULT}
                bgTextureUrl={bgTexture}
                clockParts={clockParts}
                currentLabLabel={currentLab || "—"}
                defaultPrompt={DEFAULT_PROMPT}
                hoverPrompt={HOVER_PROMPT}
                agentPrompt={agentPrompt}
                onSelectAgentKey={(key) => setSelectedAgentKey(key)}
                onStartTalk={handleStartTalk}
                onOpenFlow={openFlowReasoning}
                showPager={false}
              />
            ) : selectedBody === 1 ? (
              <BodyVariant
                bodyRef={bodyRef}
                agents={agents}
                speedMult={SPEED_MULT}
                bgTextureUrl={bgTexture}
                clockParts={clockParts}
                currentLabLabel={currentLab || "—"}
                defaultPrompt={DEFAULT_PROMPT}
                hoverPrompt={HOVER_PROMPT}
                agentPrompt={agentPrompt}
                onSelectAgentKey={(key) => setSelectedAgentKey(key)}
                onStartTalk={handleStartTalk}
                onOpenFlow={openFlowReasoning}
                onAddAgent={addSatelliteByKey}
              />
            ) : selectedBody === 2 ? (
              <BodyVariant2
                bodyRef={bodyRef}
                agents={agents}
                speedMult={SPEED_MULT}
                bgTextureUrl={bgTexture}
                clockParts={clockParts}
                currentLabLabel={currentLab || "—"}
                defaultPrompt={DEFAULT_PROMPT}
                hoverPrompt={HOVER_PROMPT}
                agentPrompt={agentPrompt}
                onSelectAgentKey={(key) => setSelectedAgentKey(key)}
                onStartTalk={handleStartTalk}
                onOpenFlow={openFlowReasoning}
              />
            ) : (
              <BodyVariant3
                bodyRef={bodyRef}
                agents={agents}
                speedMult={SPEED_MULT}
                bgTextureUrl={bgTexture}
                clockParts={clockParts}
                currentLabLabel={currentLab || "—"}
                defaultPrompt={DEFAULT_PROMPT}
                hoverPrompt={HOVER_PROMPT}
                agentPrompt={agentPrompt}
                onSelectAgentKey={(key) => setSelectedAgentKey(key)}
                onStartTalk={handleStartTalk}
                onOpenFlow={openFlowReasoning}
              />
            )}
          </div>
        </div>

        <div className="dash_rightBase" />
      </div>

      <div className="dash_overlay">
        <Group orientation="horizontal" className="dash_group">
          <Panel className="dash_panelDisabled">
            <div className="dash_panelFillTransparent" />
          </Panel>

          <Separator className="dash_separator">
            <div className="dash_separatorLine" />
          </Separator>

          <Panel
            defaultSize={RIGHT_DEFAULT_PX}
            minSize={RIGHT_MIN_PX}
            maxSize={RIGHT_MAX_PX}
            className="dash_panelEnabled"
          >
            <div className="dash_rightPane">
              <div id="right_up_plane" className="dash_rightUp">
                <SelectedAgentHeader agent={selectedAgentMeta} />
              </div>

              <div id="right_down_plane" className="dash_rightDown" />

              <Chat
                layout="planes"
                planes="downOnly"
                onFirstUserMessage={() => {
                  if (flowUserDismissedRef.current) return;
                  openFlowReasoning();
                }}
              />
            </div>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
