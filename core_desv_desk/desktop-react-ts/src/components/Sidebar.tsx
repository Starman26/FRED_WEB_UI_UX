// src/components/Sidebar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Telescope,
  MessageSquare,
  Wrench,
  LogOut,
  User,
  FlaskConical,
  ChevronDown,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

import "../styles/sidebar.css";

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
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

  const activeTeam = useMemo(() => {
    if (!activeTeamId) return null;
    return teams.find((t) => t.id === activeTeamId) || null;
  }, [teams, activeTeamId]);

  const mainSection: NavSection = useMemo(
    () => ({
      title: "MAIN",
      items: [
        { key: "inicio", label: "Dashboard", icon: Home },
        { key: "proyectos", label: "Research Lab", icon: Telescope },
        { key: "living", label: "Living Lab", icon: FlaskConical },
        { key: "chat", label: "Ask Cora", icon: MessageSquare },
      ],
    }),
    []
  );

  const configSection: NavSection = useMemo(
    () => ({
      title: "CONFIGURE",
      items: [{ key: "widget", label: "Config. Widget", icon: Wrench }],
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

        if (profErr) {
          console.warn("No pude leer profiles para miembros:", profErr);
        }

        const profileMap = new Map<string, Member>();
        (profs as Member[] | null)?.forEach((p) => {
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
      <div className="sidebar__top drag-region">
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 12,
        width: "100%",
        paddingLeft: collapsed ? 0 : 16,
        paddingRight: collapsed ? 0 : 16,
        height: 56,
      }}
    >
      <div
        className="sidebar__profileDot"
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: "rgba(255,255,255,0.18)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
          flexShrink: 0,
        }}
      />

      {!collapsed ? (
        <div className="sidebar__brand">
          <div className="sidebar__brandTitle">
            C O R A<span className="sidebar__brandDot">.</span>
          </div>
          <div className="sidebar__brandSub">Lab Assistant</div>
        </div>
      ) : null}
    </div>
  </div>


    <div className={`sidebar__workspace no-drag ${collapsed ? "is-collapsed" : ""}`}>
      {!collapsed ? (
        <div className="sidebar__workspaceInner" ref={switcherRef}>
          <button
            type="button"
            className="sidebar__workspaceBtn"
            onClick={() => setSwitcherOpen((v) => !v)}
            disabled={loadingTeams}
          >
            <div className="sidebar__workspaceLeft">
              <div className="sidebar__workspaceName">
                {loadingTeams ? "Loading labs…" : activeTeam?.name || "Select a lab"}
              </div>
              <div className="sidebar__workspaceDesc">{activeTeam?.description || " "}</div>
            </div>

            <ChevronDown className={`sidebar__chev ${switcherOpen ? "is-open" : ""}`} />
          </button>

          {switcherOpen && (
            <div className="sidebar__dropdown">
              {teams.length === 0 ? (
                <div className="sidebar__dropdownEmpty">No labs found for this user.</div>
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
                      <div className="sidebar__dropdownText">
                        <div className="sidebar__dropdownName">{t.name || "Untitled lab"}</div>
                        <div className="sidebar__dropdownDesc">{t.description || " "}</div>
                      </div>
                      {selected && <Check className="sidebar__check" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="sidebar__workspaceDot" title={activeTeam?.name || "Lab"} />
      )}
    </div>



      <div className={`sidebar__scroll no-drag ${collapsed ? "is-collapsed" : ""}`}>
        <div className="sidebar__section">
          {!collapsed && <div className="sidebar__sectionTitle">{mainSection.title}</div>}
          <div className="sidebar__sectionItems">
            {mainSection.items.map(({ key, label, icon: Icon }) => {
              const active = current === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`sidebar__item ${active ? "is-active" : ""}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="sidebar__itemIcon" />
                  {!collapsed && <span className="sidebar__itemLabel">{label}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {!collapsed && (
          <div
            style={{
              marginLeft: -8,
              marginRight: -8,
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 10,
            }}
          >
            <div className="sidebar__teamCard"></div>
          </div>
        )}

        {!collapsed && (
          <div className="sidebar__section sidebar__membersSection">
            <div className="sidebar__sectionTitle">TEAM</div>

            {loadingMembers ? (
              <div className="sidebar__hint">Loading members…</div>
            ) : members.length === 0 ? (
              <div className="sidebar__hint">No members to show.</div>
            ) : (
              <div className="sidebar__membersList">
                {members.slice(0, 12).map((m) => {
                  const displayName = m.full_name || shortId(m.auth_user_id) || "Member";
                  const initials = getInitials(m.full_name || m.auth_user_id || "?");
                  return (
                    <div key={m.id} className="sidebar__memberRow">
                      <div className="sidebar__avatar">{initials}</div>
                      <div className="sidebar__memberName">{displayName}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="sidebar__section">
          {!collapsed && <div className="sidebar__sectionTitle">{configSection.title}</div>}

          <div className="sidebar__sectionItems">
            {configSection.items.map(({ key, label, icon: Icon }) => {
              const active = current === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onNavigate(key)}
                  className={`sidebar__item ${active ? "is-active" : ""}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon className="sidebar__itemIcon" />
                  {!collapsed && <span className="sidebar__itemLabel">{label}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`sidebar__footer no-drag ${collapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          onClick={handleProfile}
          className="sidebar__footerItem"
          title={collapsed ? "My Profile" : undefined}
        >
          <User className="sidebar__footerIcon" />
          {!collapsed && <span>My Profile</span>}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className="sidebar__footerItem"
          title={collapsed ? "Log Out" : undefined}
        >
          <LogOut className="sidebar__footerIcon" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}
