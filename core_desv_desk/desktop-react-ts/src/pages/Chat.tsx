// src/pages/AskSentinela.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  Search,
  Plus,
  MessageSquare,
  Trash2,
  X,
  Clock,
  Pencil,
  Check,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/dashboard-ui.css";
import "../styles/ask.css";

const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";

// ============================================================================
// TYPES
// ============================================================================

interface ChatSession {
  id: string;
  title: string;
  lastMessage: string;
  updatedAt: Date;
  messageCount: number;
  chatMode: string;
  llmModel: string;
  tokensUsed: number;
}

interface UserProfile {
  name: string;
  role: string | null;
  teamId: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function loadUserProfile(user: any): Promise<UserProfile> {
  if (!user) return { name: "", role: null, teamId: null };

  let baseName = user.email?.split("@")[0] ?? "";
  let role: string | null = null;
  let teamId: string | null = null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("full_name, active_team_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profileData?.full_name) {
    const parts = profileData.full_name.trim().split(/\s+/);
    baseName = parts[0] || baseName;
  }

  if (profileData?.active_team_id) {
    teamId = profileData.active_team_id;
    const { data: membershipData } = await supabase
      .from("team_memberships")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("team_id", profileData.active_team_id)
      .maybeSingle();
    if (membershipData?.role) role = membershipData.role;
  }

  return { name: baseName, role, teamId };
}

// ============================================================================
// HEADER
// ============================================================================

interface HeaderProps {
  userName: string;
  userRole: string | null;
  credits: number;
  maxCredits: number;
}

function Header({ userName, userRole, credits, maxCredits }: HeaderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
  });
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContext, setEmailContext] = useState("");

  useEffect(() => {
    if (sidebarCollapsed) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
    else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(LS_KEY, next ? "1" : "0"); } catch {}
      if (next) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
      else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);
      window.dispatchEvent(new CustomEvent("cora:sidebar-toggle", { detail: { collapsed: next } }));
      return next;
    });
  }, []);

  const handleSendRequest = () => {
    setEmailSubject(""); setEmailContext(""); setShowCreditsModal(false);
    alert("Request sent!");
  };

  const displayName = userName.trim() || "User";
  const pct = maxCredits > 0 ? (credits / maxCredits) * 100 : 0;

  return (
    <>
      <header className="dash_header">
        <div className="dash_headerLeft">
          <button type="button" onClick={toggleSidebar} className="dash_menuBtn"><Menu size={18} /></button>
          <div className="dash_headerDivider" />
          <div className="dash_userInfo">
            <span className="dash_pageName">Chat History</span>
            <span className="dash_pathSeparator">/</span>
            <span className="dash_userName">{displayName}</span>
            {userRole && (<><span className="dash_userSeparator">/</span><span className="dash_userRole">{userRole}</span></>)}
          </div>
          <div className="dash_creditsContainer">
            <div className="dash_creditsBar"><div className="dash_creditsFill" style={{ width: `${pct}%` }} /></div>
            <span className="dash_creditsText">{credits.toLocaleString()} Credits Left</span>
            <button type="button" className="dash_creditsAddBtn" onClick={() => setShowCreditsModal(true)}><Plus size={14} /></button>
          </div>
        </div>
        <div className="dash_headerRight">
          <button type="button" className="dash_headerBtn">Feedback</button>
          <button type="button" className="dash_headerBtn">Docs</button>
        </div>
      </header>

      {showCreditsModal && (
        <div className="dash_modalOverlay" onClick={() => setShowCreditsModal(false)}>
          <div className="dash_creditsModal" onClick={(e) => e.stopPropagation()}>
            <div className="dash_creditsModalHeader">
              <h2>Request More Tokens</h2>
              <button type="button" className="dash_creditsModalClose" onClick={() => setShowCreditsModal(false)}><X size={18} /></button>
            </div>
            <p className="dash_creditsModalDesc">Need more tokens? Send us an email and we'll get back to you.</p>
            <div className="dash_creditsModalForm">
              <div className="dash_creditsModalField">
                <label htmlFor="email-subject">Subject</label>
                <input id="email-subject" type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="e.g., Request for additional tokens" />
              </div>
              <div className="dash_creditsModalField">
                <label htmlFor="email-context">Context</label>
                <textarea id="email-context" value={emailContext} onChange={(e) => setEmailContext(e.target.value)} placeholder="Describe your request..." rows={4} />
              </div>
              <div className="dash_creditsModalActions">
                <button type="button" className="dash_creditsModalCancel" onClick={() => setShowCreditsModal(false)}>Cancel</button>
                <button type="button" className="dash_creditsModalSubmit" onClick={handleSendRequest} disabled={!emailSubject.trim() || !emailContext.trim()}>Send Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// CHAT LIST VIEW
// ============================================================================

function ChatListView({
  sessions, searchQuery, onSearchChange, onSelectChat, onNewChat, onDeleteChat, onRenameChat, loading,
}: {
  sessions: ChatSession[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectChat: (s: ChatSession) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
  loading: boolean;
}) {
  const filtered = sessions.filter((s) => s.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startRename = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const confirmRename = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== sessions.find((s) => s.id === id)?.title) {
      onRenameChat(id, trimmed);
    }
    setEditingId(null);
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const executeDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteChat(id);
    setDeletingId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
  };

  return (
    <div className="ask_listView">
      <div className="ask_listSection">
        <div className="ask_listHeader">
          <h2 className="ask_listTitle">Chat History</h2>
          <button className="ask_newChatBtn" onClick={onNewChat}>
            <Plus size={16} /><span>New chat</span>
          </button>
        </div>

        <div className="ask_searchBox">
          <Search size={16} className="ask_searchIcon" />
          <input type="text" className="ask_searchInput" placeholder="Search your chats..." value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
          {searchQuery && <button className="ask_searchClear" onClick={() => onSearchChange("")}><X size={14} /></button>}
        </div>

        <div className="ask_listMeta">
          <span>{filtered.length} conversation{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="ask_chatList">
          {loading ? (
            <div className="ask_listLoading"><div className="ask_loadingDots"><span /><span /><span /></div></div>
          ) : filtered.length === 0 ? (
            <div className="ask_emptyList">
              <MessageSquare size={32} className="ask_emptyIcon" />
              <p className="ask_emptyText">{searchQuery ? "No chats match your search" : "No chats yet. Start a new conversation!"}</p>
            </div>
          ) : (
            filtered.map((session) => (
              <div
                key={session.id}
                className="ask_chatItem"
                onClick={() => { if (editingId !== session.id && deletingId !== session.id) onSelectChat(session); }}
                style={{ position: "relative" }}
              >
                <div className="ask_chatItemContent" style={{ flex: 1, minWidth: 0 }}>
                  {/* Title: editable or static */}
                  {editingId === session.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmRename(session.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => confirmRename(session.id)}
                        className="ask_chatItemRenameInput"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); confirmRename(session.id); }}
                        className="ask_chatItemRenameConfirm"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <h3 className="ask_chatItemTitle">{session.title}</h3>
                  )}

                  {session.lastMessage && editingId !== session.id && (
                    <p className="ask_chatItemPreview">{session.lastMessage}</p>
                  )}

                  {editingId !== session.id && (
                    <div className="ask_chatItemMetaRow">
                      <Clock size={12} />
                      <span>{formatRelativeTime(session.updatedAt)}</span>
                      <span>·</span>
                      <span>{session.messageCount} message{session.messageCount !== 1 ? "s" : ""}</span>
                      {session.chatMode && <><span>·</span><span>{session.chatMode}</span></>}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                {editingId !== session.id && (
                  <div className="ask_chatItemActionsRow">
                    {deletingId === session.id ? (
                      <div className="ask_chatItemConfirmRow" onClick={(e) => e.stopPropagation()}>
                        <span className="ask_chatItemConfirmText">Delete?</span>
                        <button onClick={(e) => executeDelete(e, session.id)} className="ask_chatItemConfirmYes">
                          Yes
                        </button>
                        <button onClick={cancelDelete} className="ask_chatItemConfirmNo">
                          No
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => startRename(e, session)}
                          title="Rename"
                          className="ask_chatItemActionBtn"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={(e) => confirmDelete(e, session.id)}
                          title="Delete"
                          className="ask_chatItemActionBtn ask_chatItemActionBtn--delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AskSentinela() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [userProfile, setUserProfile] = useState<UserProfile>({ name: "", role: null, teamId: null });
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalTokens, setTotalTokens] = useState(10000);
  const [remainingTokens, setRemainingTokens] = useState(10000);

  // Apply saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("cora.theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }, []);

  // ── Load user profile ──
  useEffect(() => {
    if (!user) return;
    loadUserProfile(user).then(setUserProfile);
  }, [user]);

  // ── Load sessions from Supabase ──
  useEffect(() => {
    if (!user || !userProfile.teamId) return;

    const load = async () => {
      setLoading(true);

      // Token balance
      const { data: balanceData, error: balanceErr } = await supabase
        .schema("chat")
        .rpc("get_token_balance", { p_auth_user_id: user.id, p_team_id: userProfile.teamId });
      if (balanceErr) console.error("[Ask] Token balance error:", balanceErr);
      if (balanceData?.[0]) {
        setTotalTokens(balanceData[0].total_tokens);
        setRemainingTokens(balanceData[0].remaining_tokens);
      }

      // Sessions
      const { data: sessionsData, error: sessionsErr } = await supabase
        .schema("chat")
        .from("sessions")
        .select("id, title, status, chat_mode, llm_model, message_count, tokens_used, created_at, updated_at")
        .eq("auth_user_id", user.id)
        .eq("team_id", userProfile.teamId)
        .eq("status", "active")
        .neq("chat_mode", "analysis")
        .order("updated_at", { ascending: false });

      if (sessionsErr) console.error("[Ask] Sessions error:", sessionsErr);

      if (sessionsData && sessionsData.length > 0) {
        const loaded: ChatSession[] = [];
        for (const s of sessionsData) {
          // Get last message preview
          const { data: lastMsg } = await supabase
            .schema("chat").from("messages")
            .select("content, sender")
            .eq("session_id", s.id)
            .order("created_at", { ascending: false })
            .limit(1).maybeSingle();

          const preview = lastMsg && lastMsg.sender !== "user"
            ? (lastMsg.content || "").slice(0, 80)
            : "";

          loaded.push({
            id: s.id,
            title: s.title,
            lastMessage: preview,
            updatedAt: new Date(s.updated_at),
            messageCount: s.message_count || 0,
            chatMode: s.chat_mode || "",
            llmModel: s.llm_model || "",
            tokensUsed: s.tokens_used || 0,
          });
        }
        setSessions(loaded);
      } else {
        setSessions([]);
      }
      setLoading(false);
    };

    load();
  }, [user, userProfile.teamId]);

  // ── Select chat → go to Dashboard with that session ──
  const handleSelectChat = (session: ChatSession) => {
    try { sessionStorage.setItem("sentinela.continueSessionId", session.id); } catch {}
    navigate("/dashboard");
  };

  // ── New chat → create session + go to Dashboard ──
  const handleNewChat = async () => {
    if (user && userProfile.teamId) {
      const newId = crypto.randomUUID();
      const { error } = await supabase.schema("chat").from("sessions").insert({
        id: newId,
        auth_user_id: user.id,
        team_id: userProfile.teamId,
        title: `Chat ${sessions.length + 1}`,
      });
      if (error) console.error("[Ask] Failed to create session:", error);
      try { sessionStorage.setItem("sentinela.continueSessionId", newId); } catch {}
    }
    navigate("/dashboard");
  };

  // ── Delete session permanently (messages + session) ──
  const handleDeleteChat = async (id: string) => {
    // Optimistically remove from UI immediately for snappy UX
    setSessions((prev) => prev.filter((s) => s.id !== id));

    let success = false;

    // Strategy 1: Soft-delete (most reliable with RLS policies)
    try {
      const { error: archiveErr } = await supabase
        .schema("chat")
        .from("sessions")
        .update({ status: "deleted" })
        .eq("id", id);

      if (!archiveErr) {
        success = true;
        console.log("[Ask] Session soft-deleted (archived):", id);
      } else {
        console.warn("[Ask] Soft-delete failed:", archiveErr.message);
      }
    } catch (e) {
      console.warn("[Ask] Soft-delete exception:", e);
    }

    // Strategy 2: Hard-delete messages then session (if soft-delete failed)
    if (!success) {
      try {
        // Delete all messages linked to this session first (FK constraint)
        const { error: msgErr } = await supabase
          .schema("chat")
          .from("messages")
          .delete()
          .eq("session_id", id);
        if (msgErr) console.warn("[Ask] Hard-delete messages error:", msgErr.message);

        // Now delete the session itself
        const { error: sessErr } = await supabase
          .schema("chat")
          .from("sessions")
          .delete()
          .eq("id", id);

        if (!sessErr) {
          success = true;
          console.log("[Ask] Session hard-deleted:", id);
        } else {
          console.error("[Ask] Hard-delete session error:", sessErr.message);
        }
      } catch (e) {
        console.error("[Ask] Hard-delete exception:", e);
      }
    }

    // Strategy 3: Use RPC if both above failed (server-side function)
    if (!success) {
      try {
        const { error: rpcErr } = await supabase
          .schema("chat")
          .rpc("delete_session", { p_session_id: id });

        if (!rpcErr) {
          success = true;
          console.log("[Ask] Session deleted via RPC:", id);
        } else {
          console.warn("[Ask] RPC delete_session not available or failed:", rpcErr.message);
        }
      } catch (e) {
        console.warn("[Ask] RPC fallback exception:", e);
      }
    }

    if (!success) {
      console.error("[Ask] All delete strategies failed for session:", id);
      // Re-fetch sessions to restore accurate state since optimistic update may be wrong
      // (the session may still exist in DB)
      if (user && userProfile.teamId) {
        const { data: sessionsData } = await supabase
          .schema("chat")
          .from("sessions")
          .select("id, title, status, chat_mode, llm_model, message_count, tokens_used, created_at, updated_at")
          .eq("auth_user_id", user.id)
          .eq("team_id", userProfile.teamId)
          .eq("status", "active")
          .order("updated_at", { ascending: false });

        if (sessionsData) {
          const reloaded: ChatSession[] = sessionsData.map((s) => ({
            id: s.id,
            title: s.title,
            lastMessage: "",
            updatedAt: new Date(s.updated_at),
            messageCount: s.message_count || 0,
            chatMode: s.chat_mode || "",
            llmModel: s.llm_model || "",
            tokensUsed: s.tokens_used || 0,
          }));
          setSessions(reloaded);
        }
      }
    }
  };

  // ── Rename session ──
  const handleRenameChat = async (id: string, newTitle: string) => {
    const { error } = await supabase.schema("chat").from("sessions")
      .update({ title: newTitle }).eq("id", id);
    if (error) {
      console.error("[Ask] Rename error:", error);
      return;
    }
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title: newTitle } : s));
  };

  return (
    <div className="ask_root">
      <Header userName={userProfile.name} userRole={userProfile.role} credits={remainingTokens} maxCredits={totalTokens} />
      <main className="ask_main">
        <ChatListView
          sessions={sessions} searchQuery={searchQuery} onSearchChange={setSearchQuery}
          onSelectChat={handleSelectChat} onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat} loading={loading}
        />
      </main>
    </div>
  );
}