// src/components/Sidebar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BeakerIcon,
  ArrowRightOnRectangleIcon,
  UserIcon,
  ChevronUpDownIcon,
  CheckIcon,
  SparklesIcon,
  InformationCircleIcon,
  XMarkIcon,
  UserCircleIcon,
  ClockIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useThinking } from "../context/Thinkingcontext";
import { supabase } from "../lib/supabaseClient";

import orionLogo from "../assets/ORION_LOGO.png";
import orionLogoWhite from "../assets/ORION_LOGO_WHITE.png";
import "../styles/sidebar.css";

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  isSubitem?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

type Team = {
  id: string;
  name: string;
  description: string | null;
};

type TeamMembershipRow = {
  team_id: string;
  role: string;
  teams: Team | Team[] | null;
};

type MembershipLite = {
  auth_user_id: string | null;
  role?: string | null;
};

type Member = {
  id: string;
  full_name: string | null;
  auth_user_id: string | null;
};

const LS_KEY = "cora_sidebar_collapsed";
const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";

function getInitials(value: string | null): string {
  if (!value) return "?";
  const clean = value.trim();
  if (!clean) return "?";
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return clean.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortId(v: string | null) {
  if (!v) return "Unknown";
  if (v.length <= 10) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  onOutside: () => void
) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

export function Sidebar({
  current,
  onNavigate,
  onTeamChange,
}: {
  current: string;
  onNavigate: (key: string) => void;
  onTeamChange?: (teamId: string) => void;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { isThinking } = useThinking();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
    } catch {}

    if (collapsed) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
    else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
  }, [collapsed]);

  useEffect(() => {
    const onToggle = (e: Event) => {
      const ce = e as CustomEvent<{ collapsed?: boolean }>;
      const next = Boolean(ce.detail?.collapsed);
      setCollapsed(next);
    };

    window.addEventListener("cora:sidebar-toggle", onToggle as EventListener);
    return () => window.removeEventListener("cora:sidebar-toggle", onToggle as EventListener);
  }, []);

  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);

  const switcherRef = useRef<HTMLDivElement>(null);
  useClickOutside(switcherRef, () => setSwitcherOpen(false));

  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Agent info modal state
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [showAgentInfo, setShowAgentInfo] = useState(false);

  const activeTeam = useMemo(() => {
    if (!activeTeamId) return null;
    return teams.find((t) => t.id === activeTeamId) || null;
  }, [teams, activeTeamId]);

  // Combine all nav items into a single array for collapsed view
  const allNavItems: NavItem[] = useMemo(
    () => [
      { key: "inicio", label: "Agent", icon: UserCircleIcon, badge: null },
      { key: "proyectos", label: "Studio", icon: SparklesIcon, badge: "Beta" },
      { key: "living", label: "Living Lab", icon: BeakerIcon, badge: null },
      { key: "chat", label: "History", icon: ClockIcon, badge: null },
      { key: "widget", label: "Analysis", icon: ChartBarIcon, badge: null },
    ],
    []
  );

  const mainSection: NavSection = useMemo(
    () => ({
      title: "Main",
      items: [
        { key: "inicio", label: "Agent", icon: UserCircleIcon, badge: null },
        { key: "proyectos", label: "Studio", icon: SparklesIcon, badge: "Beta", isSubitem: true },
        { key: "living", label: "Living Lab", icon: BeakerIcon, badge: null },
        { key: "chat", label: "History", icon: ClockIcon, badge: null },
      ],
    }),
    []
  );

  const configSection: NavSection = useMemo(
    () => ({
      title: "Configure",
      items: [{ key: "widget", label: "Analysis", icon: ChartBarIcon }],
    }),
    []
  );

  const normalizeTeam = (t: Team | Team[] | null): Team | null => {
    if (!t) return null;
    return Array.isArray(t) ? t[0] ?? null : t;
  };

  useEffect(() => {
    const loadTeams = async () => {
      setLoadingTeams(true);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;

        if (!user) {
          setTeams([]);
          setActiveTeamId(null);
          return;
        }

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("active_team_id")
          .eq("auth_user_id", user.id)
          .maybeSingle();

        if (profileErr) {
          console.warn("No pude leer profiles.active_team_id:", profileErr);
        }

        const { data: memberships, error: memErr } = await supabase
          .from("team_memberships")
          .select("team_id, role, teams:teams(id, name, description)")
          .eq("auth_user_id", user.id);

        if (memErr) throw memErr;

        const rows = (memberships ?? []) as TeamMembershipRow[];
        const labs: Team[] = rows
          .map((m) => normalizeTeam(m.teams))
          .filter((t): t is Team => Boolean(t));

        const uniq = Array.from(new Map(labs.map((t) => [t.id, t])).values());

        setTeams(uniq);

        const preferred = (profile as any)?.active_team_id as string | null;
        const fallback = uniq[0]?.id ?? null;

        setActiveTeamId(
          preferred && uniq.some((t) => t.id === preferred) ? preferred : fallback
        );
      } catch (e) {
        console.error("Error cargando labs:", e);
        setTeams([]);
        setActiveTeamId(null);
      } finally {
        setLoadingTeams(false);
      }
    };

    loadTeams();
  }, []);

  useEffect(() => {
    const loadMembers = async () => {
      if (!activeTeamId) {
        setMembers([]);
        return;
      }

      setLoadingMembers(true);
      try {
        const { data: mems, error: memErr } = await supabase
          .from("team_memberships")
          .select("auth_user_id, role")
          .eq("team_id", activeTeamId)
          .limit(50);

        if (memErr) throw memErr;

        const membershipRows = (mems ?? []) as MembershipLite[];
        const ids = membershipRows
          .map((r) => r.auth_user_id)
          .filter(Boolean) as string[];

        if (ids.length === 0) {
          setMembers([]);
          return;
        }

        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, full_name, auth_user_id")
          .in("auth_user_id", ids)
          .limit(50);

        if (profErr) throw profErr;

        const profileMap = new Map<string, Member>();
        (profs ?? []).forEach((p: any) => {
          if (p.auth_user_id) profileMap.set(p.auth_user_id, p);
        });

        const merged: Member[] = ids.map((authId) => {
          const p = profileMap.get(authId);
          if (p) return p;
          return { id: authId, full_name: null, auth_user_id: authId };
        });

        merged.sort((a, b) => {
          const an = a.full_name || shortId(a.auth_user_id);
          const bn = b.full_name || shortId(b.auth_user_id);
          return an.localeCompare(bn);
        });

        setMembers(merged);
      } catch (e) {
        console.error("Error cargando miembros:", e);
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    loadMembers();
  }, [activeTeamId]);

  const handleSelectTeam = async (teamId: string) => {
    setActiveTeamId(teamId);
    setSwitcherOpen(false);

    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) throw userErr;
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ active_team_id: teamId })
        .eq("auth_user_id", user.id);

      if (error) throw error;

      onTeamChange?.(teamId);
    } catch (e) {
      console.error("No pude actualizar active_team_id:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  };

  const handleProfile = () => navigate("/profile");

  return (
    <aside className={`sidebar drag-region ${collapsed ? "is-collapsed" : ""}`}>
      {/* Header with user avatar */}
      <div className="sidebar__header drag-region">
        <div className="sidebar__avatar-large">
          <img src={orionLogo} alt="Orion Logo" className="sidebar__logo--default" />
          <img src={orionLogoWhite} alt="Orion Logo" className="sidebar__logo--white" />
        </div>
        
        <div className="sidebar__brand">
          <div className="sidebar__brandTitle sidebar__brandTitle--spaced">
            ORION
          </div>
          <div className="sidebar__brandSub">Lab Assistant</div>
        </div>
      </div>

      {/* Workspace selector */}
      <div className={`sidebar__workspace no-drag ${collapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar__workspaceInner" ref={switcherRef}>
          <button
            type="button"
            className="sidebar__workspaceBtn"
            onClick={() => setSwitcherOpen((v) => !v)}
            disabled={loadingTeams}
          >
            <span className="sidebar__workspaceName">
              {loadingTeams ? "Loading..." : activeTeam?.name || "Select lab"}
            </span>
            <ChevronUpDownIcon className="sidebar__chev" />
          </button>

          {switcherOpen && (
            <div className="sidebar__dropdown">
              {teams.length === 0 ? (
                <div className="sidebar__dropdownEmpty">No labs found</div>
              ) : (
                teams.map((t) => {
                  const selected = t.id === activeTeamId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`sidebar__dropdownItem ${selected ? "is-selected" : ""}`}
                      onClick={() => handleSelectTeam(t.id)}
                    >
                      <span className="sidebar__dropdownName">{t.name || "Untitled"}</span>
                      {selected && <CheckIcon className="sidebar__check" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        <div className="sidebar__workspaceDot" title={activeTeam?.name || "Lab"} />
      </div>

      {/* Navigation */}
      <div className={`sidebar__scroll no-drag ${collapsed ? "is-collapsed" : ""}`}>

        {/* COLLAPSED VIEW: Icons separated in two groups */}
        <div className="sidebar__collapsedNav">
          <div className="sidebar__collapsedGroup sidebar__collapsedGroup--top">
            {allNavItems.filter(item => item.key !== "widget").map(({ key, label, icon: Icon }) => {
              const active = current === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`sidebar__item ${active ? "is-active" : ""}`}
                  title={label}
                >
                  <Icon className="sidebar__itemIcon" />
                </button>
              );
            })}
          </div>
          <div className="sidebar__collapsedGroup sidebar__collapsedGroup--bottom">
            {allNavItems.filter(item => item.key === "widget").map(({ key, label, icon: Icon }) => {
              const active = current === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`sidebar__item ${active ? "is-active" : ""}`}
                  title={label}
                >
                  <Icon className="sidebar__itemIcon" />
                </button>
              );
            })}
          </div>
        </div>

        {/* EXPANDED VIEW: Sections with titles, team card, members */}
        <div className="sidebar__expandedNav">
          {/* Main Section */}
          <div className="sidebar__section">
            <div className="sidebar__sectionTitle">{mainSection.title}</div>
            <div className="sidebar__sectionItems">
              {mainSection.items.map(({ key, label, icon: Icon, badge, isSubitem }) => {
                const active = current === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onNavigate(key)}
                    className={`sidebar__item ${active ? "is-active" : ""} ${isSubitem ? "is-subitem" : ""}`}
                  >
                    <Icon className="sidebar__itemIcon" />
                    <span className="sidebar__itemLabel">{label}</span>
                    {badge && <span className="sidebar__badge">{badge}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team card with Pixel Eyes */}
          <div
            className="sidebar__teamCard"
            onMouseEnter={() => setIsCardHovered(true)}
            onMouseLeave={() => setIsCardHovered(false)}
          >
            <div className={`sidebar__simpleEyes ${isThinking ? "is-thinking" : ""}`}>
              <div className="sidebar__eye"></div>
              <div className="sidebar__eye"></div>
            </div>

            {/* Info button - appears on hover */}
            <button
              type="button"
              className={`sidebar__infoBtn ${isCardHovered ? "is-visible" : ""}`}
              onClick={() => setShowAgentInfo(true)}
              aria-label="About Sentinela"
            >
              <InformationCircleIcon className="sidebar__infoBtnIcon" />
            </button>
          </div>

          {/* Team members */}
          <div className="sidebar__section sidebar__membersSection">
            <div className="sidebar__sectionTitle">Team</div>

            {loadingMembers ? (
              <div className="sidebar__hint">Loading...</div>
            ) : members.length === 0 ? (
              <div className="sidebar__hint">No members</div>
            ) : (
              <div className="sidebar__membersList">
                {members.slice(0, 8).map((m) => {
                  const displayName = m.full_name || shortId(m.auth_user_id) || "Member";
                  const initials = getInitials(m.full_name || m.auth_user_id || "?");
                  return (
                    <div key={m.id} className="sidebar__memberRow">
                      <div className="sidebar__avatar">{initials}</div>
                      <span className="sidebar__memberName">{displayName}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Config section */}
          <div className="sidebar__section">
            <div className="sidebar__sectionTitle">{configSection.title}</div>
            <div className="sidebar__sectionItems">
              {configSection.items.map(({ key, label, icon: Icon }) => {
                const active = current === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onNavigate(key)}
                    className={`sidebar__item ${active ? "is-active" : ""}`}
                  >
                    <Icon className="sidebar__itemIcon" />
                    <span className="sidebar__itemLabel">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={`sidebar__footer no-drag ${collapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          onClick={handleProfile}
          className="sidebar__footerItem"
          title={collapsed ? "My Profile" : undefined}
        >
          <UserIcon className="sidebar__footerIcon" />
          <span>My Profile</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="sidebar__footerItem"
          title={collapsed ? "Log Out" : undefined}
        >
          <ArrowRightOnRectangleIcon className="sidebar__footerIcon" />
          <span>Log Out</span>
        </button>
      </div>

      {/* Agent Info Modal */}
      {showAgentInfo && (
        <div className="sidebar__agentModalOverlay" onClick={() => setShowAgentInfo(false)}>
          <div className="sidebar__agentModal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="sidebar__agentModalClose"
              onClick={() => setShowAgentInfo(false)}
            >
              <XMarkIcon className="sidebar__agentModalCloseIcon" />
            </button>
            
            <div className="sidebar__agentModalHeader">
              <div className="sidebar__agentModalEyes">
                <div className="sidebar__agentModalEye" />
                <div className="sidebar__agentModalEye" />
              </div>
            </div>
            
            <div className="sidebar__agentModalContent">
              <h3 className="sidebar__agentModalTitle">
                Hi, I'm Sentinela
              </h3>
              <p className="sidebar__agentModalSubtitle">
                The Main Agent for your lab. Happy to be working with you!
              </p>
              
              <div className="sidebar__agentModalSection">
                <h4 className="sidebar__agentModalSectionTitle">This is what I can do:</h4>
                <ul className="sidebar__agentModalList">
                  <li>
                    <span className="sidebar__agentModalBullet">→</span>
                    Answer questions about your data and processes
                  </li>
                  <li>
                    <span className="sidebar__agentModalBullet">→</span>
                    Help troubleshoot issues in your lab equipment
                  </li>
                  <li>
                    <span className="sidebar__agentModalBullet">→</span>
                    Generate reports and analyze trends
                  </li>
                  <li>
                    <span className="sidebar__agentModalBullet">→</span>
                    Connect with your knowledge base and documentation
                  </li>
                  <li>
                    <span className="sidebar__agentModalBullet">→</span>
                    Execute tasks and automate workflows
                  </li>
                </ul>
              </div>
              
              <p className="sidebar__agentModalFooter">
                Just ask me anything in the chat. I'm here to help!
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}