// src/components/TopBar.tsx
import {
  Search,
  MessageSquareText,
  Bell,
  ContactRound,
  Minus,
  X,
  Square,
  Plus,
  PanelLeft,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/topbar.css";

type StudentRow = {
  avatar_url: string | null;
  full_name: string | null;
  email: string | null;
};

type AppUserRow = {
  role: "admin_equipos" | "laboratorista" | null;
};

const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";

export function TopBar() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [initial, setInitial] = useState<string>("L");
  const [roleLabel, setRoleLabel] = useState<string>("Student");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);

  const initialCollapsed = useMemo(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    setSidebarCollapsed(initialCollapsed);
    if (initialCollapsed) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
    else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
  }, [initialCollapsed]);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setAvatarUrl(null);
        setInitial("?");
        setRoleLabel("Invitado");
        return;
      }

      const { data: student } = await supabase
        .from("students")
        .select("avatar_url, full_name, email")
        .eq("auth_user_id", user.id)
        .maybeSingle<StudentRow>();

      if (student?.avatar_url) setAvatarUrl(student.avatar_url);

      const nameOrEmail = student?.full_name || student?.email || user.email || "";
      setInitial((nameOrEmail || "?").charAt(0).toUpperCase() || "?");

      const { data: appUser } = await supabase
        .from("app_user")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<AppUserRow>();

      if (appUser?.role === "admin_equipos") setRoleLabel("Admin");
      else if (appUser?.role === "laboratorista") setRoleLabel("Laboratorista");
      else setRoleLabel("Student");
    }

    loadProfile();
  }, [user]);

  function toggleSidebar() {
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
  }

  return (
    <header className="drag-region topbar">
      <div className="no-drag topbar__inner">
        <div className="topbar__left">
          <button
            className="topbar__teamsToggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={sidebarCollapsed}
            type="button"
          >
            <PanelLeft className="topbar__teamsIcon" />
          </button>

          <div className="topbar__searchWrap">
            <Search className="topbar__searchIcon" />
            <input className="topbar__searchInput" type="text" placeholder="Search..." />
          </div>

          <button className="topbar__addBtn" type="button">
            <Plus className="topbar__icon" />
            <span className="topbar__addText">Add</span>
          </button>
        </div>

        <div className="topbar__right">
          <div className="topbar__rolePill">
            <ContactRound className="topbar__iconMuted" />
            <span>Role: {roleLabel}</span>
          </div>

          <button className="topbar__iconBtn" type="button" aria-label="Messages">
            <MessageSquareText className="topbar__iconMuted" />
          </button>
          <button className="topbar__iconBtn" type="button" aria-label="Notifications">
            <Bell className="topbar__iconMuted" />
          </button>

          <div className="topbar__avatarWrap">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="topbar__avatarImg" />
            ) : (
              <div className="topbar__avatarFallback">{initial}</div>
            )}
          </div>

          <div className="topbar__windowControls">
            <button
              onClick={() => (window as any).electronAPI?.minimize?.()}
              className="topbar__winBtn"
              type="button"
              aria-label="Minimize"
            >
              <Minus className="topbar__winIcon" />
            </button>
            <button
              onClick={() => (window as any).electronAPI?.toggleMaximize?.()}
              className="topbar__winBtn"
              type="button"
              aria-label="Maximize"
            >
              <Square className="topbar__winIcon" />
            </button>
            <button
              onClick={() => (window as any).electronAPI?.close?.()}
              className="topbar__winBtn topbar__winBtn--danger"
              type="button"
              aria-label="Close"
            >
              <X className="topbar__winIcon topbar__winIcon--danger" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
