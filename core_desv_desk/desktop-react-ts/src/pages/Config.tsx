// src/pages/Config.tsx — Analysis page with real Supabase data + embedded chat
import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, Plus, X, Search, BarChart2, PieChart, TrendingUp, Activity, Clock, Target } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useThinking } from "../context/Thinkingcontext";
import { useAgentChat } from "../components/useAgentChat";
import type { AgentEvent, ChatImage } from "../components/useAgentChat";
import {
  MessageBubble,
  ChatInput,
  InlineEventRun,
  FollowUpSuggestions,
  type PastedContent,
  type ImageAttachment,
  type Message,
  type TimelineEvent,
  type EventRun,
  type FollowUpSuggestion,
} from "../components/ChatComponents";
import "../styles/analysis-ui.css";
import "../styles/dashboard-ui.css";

const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";
const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || "https://sentinela-909652673285.us-central1.run.app";

// ============================================================================
// TYPES
// ============================================================================

interface AnalysisSession {
  id: string;
  title: string;
  description: string;
  iconIndex: number;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  lastUserMessage: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

async function loadUserProfile(user: any): Promise<{ name: string; role: string | null; teamId: string | null }> {
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

  teamId = profileData?.active_team_id ?? null;

  if (teamId) {
    const { data: membershipData } = await supabase
      .from("team_memberships")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("team_id", teamId)
      .maybeSingle();

    if (membershipData?.role) {
      role = membershipData.role;
    }
  }

  return { name: baseName, role, teamId };
}

/** Deterministic icon index from session ID */
function hashIconIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 6;
}

const CARD_ICONS = [BarChart2, Clock, TrendingUp, Activity, PieChart, Target];

function getCardIconByIndex(index: number) {
  const Icon = CARD_ICONS[index % CARD_ICONS.length];
  return <Icon size={20} strokeWidth={1.5} />;
}

// ============================================================================
// ICONS
// ============================================================================

function AgentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="6" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="12" cy="9" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

// ============================================================================
// ANALYSIS HEADER
// ============================================================================

interface AnalysisHeaderProps {
  userName: string;
  userRole: string;
  userError: string | null;
  onChangeAgent: () => void;
}

function AnalysisHeader({ userName, userRole, userError, onChangeAgent }: AnalysisHeaderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
  });

  const [credits, _setCredits] = useState(10000);
  const maxCredits = 10000;
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
    console.log("Token request:", { subject: emailSubject, context: emailContext });
    setEmailSubject("");
    setEmailContext("");
    setShowCreditsModal(false);
    alert("Request sent! We'll get back to you shortly.");
  };

  const displayName = userName || "User";
  const displayRole = userRole || null;
  const creditsPercentage = (credits / maxCredits) * 100;

  return (
    <>
      <header className="analysis_header">
        <div className="analysis_headerLeft">
          <button type="button" onClick={toggleSidebar} className="analysis_menuBtn" aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Menu size={18} />
          </button>
          <div className="analysis_headerDivider" />
          <div className="analysis_userInfo">
            <span className="analysis_pageName">Analysis</span>
            <span className="analysis_pathSeparator">/</span>
            <span className="analysis_userName">{displayName}</span>
            {displayRole && (
              <>
                <span className="analysis_userSeparator">/</span>
                <span className="analysis_userRole">{displayRole}</span>
              </>
            )}
          </div>
          {userError && <span className="analysis_userError">({userError})</span>}
          <div className="analysis_creditsContainer">
            <div className="analysis_creditsBar">
              <div className="analysis_creditsFill" style={{ width: `${creditsPercentage}%` }} />
            </div>
            <span className="analysis_creditsText">{credits.toLocaleString()} Credits Left</span>
            <button type="button" className="analysis_creditsAddBtn" onClick={() => setShowCreditsModal(true)} aria-label="Request more credits">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="analysis_headerRight">
          <button type="button" className="analysis_changeAgentBtn" onClick={onChangeAgent}>
            <AgentIcon />
            <span>Change agent</span>
          </button>
          <div className="analysis_headerDivider" />
          <button type="button" className="analysis_headerBtn">Feedback</button>
          <button type="button" className="analysis_headerBtn">Docs</button>
        </div>
      </header>

      {showCreditsModal && (
        <div className="analysis_modalOverlay" onClick={() => setShowCreditsModal(false)}>
          <div className="analysis_creditsModal" onClick={(e) => e.stopPropagation()}>
            <div className="analysis_creditsModalHeader">
              <h2>Request More Tokens</h2>
              <button type="button" className="analysis_creditsModalClose" onClick={() => setShowCreditsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p className="analysis_creditsModalDesc">
              Need more tokens? Send us an email with the context of your request and we'll get back to you shortly.
            </p>
            <div className="analysis_creditsModalForm">
              <div className="analysis_creditsModalField">
                <label htmlFor="email-subject">Subject</label>
                <input id="email-subject" type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="e.g., Request for additional research tokens" />
              </div>
              <div className="analysis_creditsModalField">
                <label htmlFor="email-context">Context of your request</label>
                <textarea id="email-context" value={emailContext} onChange={(e) => setEmailContext(e.target.value)} placeholder="Please describe why you need additional tokens and how you plan to use them..." rows={4} />
              </div>
              <div className="analysis_creditsModalActions">
                <button type="button" className="analysis_creditsModalCancel" onClick={() => setShowCreditsModal(false)}>Cancel</button>
                <button type="button" className="analysis_creditsModalSubmit" onClick={handleSendRequest} disabled={!emailSubject.trim() || !emailContext.trim()}>Send Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// CREATE ANALYSIS MODAL
// ============================================================================

interface CreateModalProps {
  userName: string;
  onSave: (title: string, description: string, iconIndex: number) => void;
  onClose: () => void;
}

function CreateAnalysisModal({ userName, onSave, onClose }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(0);

  const handleSave = () => {
    onSave(title || "Untitled Analysis", description || "", selectedIcon);
  };

  return (
    <div className="analysis_modalOverlay" onClick={onClose}>
      <div className="analysis_creditsModal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="analysis_creditsModalHeader">
          <h2>Create Analysis</h2>
          <button type="button" className="analysis_creditsModalClose" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="analysis_creditsModalForm">
          <div className="analysis_creditsModalField">
            <label htmlFor="analysis-title">Name</label>
            <input id="analysis-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter analysis name..." />
          </div>
          <div className="analysis_creditsModalField">
            <label htmlFor="analysis-desc">Description</label>
            <textarea id="analysis-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what this analysis does..." rows={3} />
          </div>
          <div className="analysis_creditsModalField">
            <label>Icon</label>
            <div className="analysis_iconSelect">
              {CARD_ICONS.map((Icon, i) => (
                <button
                  key={i}
                  type="button"
                  className={`analysis_iconOption ${selectedIcon === i ? "analysis_iconOption--selected" : ""}`}
                  onClick={() => setSelectedIcon(i)}
                >
                  <Icon size={20} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
          <div className="analysis_creditsModalActions">
            <span style={{ flex: 1, fontSize: 13, color: "rgba(16,17,19,0.5)" }}>
              Created by {userName || "User"}
            </span>
            <button type="button" className="analysis_creditsModalCancel" onClick={onClose}>Cancel</button>
            <button type="button" className="analysis_creditsModalSubmit" onClick={handleSave}>Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ANALYSIS CARD
// ============================================================================

interface CardProps {
  session: AnalysisSession;
  isSelected: boolean;
  onClick: () => void;
}

function AnalysisCardItem({ session, isSelected, onClick }: CardProps) {
  return (
    <button
      type="button"
      className={`analysis_card ${isSelected ? "analysis_card--selected" : ""}`}
      onClick={onClick}
    >
      <div className="analysis_cardHeader">
        <div className="analysis_cardIcon">
          {getCardIconByIndex(session.iconIndex)}
        </div>
        <span className="analysis_cardTitle">{session.title}</span>
        {isSelected && (
          <div className="analysis_cardCheck">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
      </div>
      <p className="analysis_cardDesc">
        {session.lastUserMessage || session.description || "No messages yet"}
      </p>
      <div className="analysis_cardAuthor">
        <div className="analysis_cardAuthorAvatar">
          {session.authorName.charAt(0).toUpperCase()}
        </div>
        <span className="analysis_cardAuthorName">{session.authorName}</span>
      </div>
    </button>
  );
}

// ============================================================================
// MAIN ANALYSIS PAGE
// ============================================================================

export default function Analysis() {
  // User state
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);

  // Sessions from Supabase
  const [analysisSessions, setAnalysisSessions] = useState<AnalysisSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState("");

  // Selected session & chat messages
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMessage, setChatMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);

  // Event runs (same pattern as Dashboard)
  const [eventRuns, setEventRuns] = useState<Record<string, EventRun>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const lastResponseRef = useRef<string>("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Thinking context
  const { setIsThinking } = useThinking();

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep activeRunIdRef in sync
  useEffect(() => { activeRunIdRef.current = activeRunId; }, [activeRunId]);

  // ── useAgentChat ──
  const {
    sendMessage: sendToAgent,
    suggestions: agentSuggestions,
  } = useAgentChat({
    apiUrl: AGENT_API_URL,
    userId: userId || undefined,
    userName: userName || "Usuario",
    sessionId: selectedSessionId || undefined,
    interactionMode: "analysis",
    onEvent: (evt: AgentEvent) => {
      if (evt.type === "tokens") return;

      const timelineEvt: TimelineEvent = {
        id: crypto.randomUUID(),
        node: evt.source.toUpperCase().replace("_NODE", "").replace("_", " "),
        message: evt.content,
        timestamp: evt.timestamp,
      };

      setEventRuns((prev) => {
        const runId = activeRunIdRef.current;
        if (!runId || !prev[runId]) return prev;
        return {
          ...prev,
          [runId]: { ...prev[runId], events: [...prev[runId].events, timelineEvt] },
        };
      });
    },
    onResponse: (responseContent: string) => {
      if (lastResponseRef.current === responseContent) return;
      lastResponseRef.current = responseContent;

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        text: responseContent,
        sender: "ai",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Persist AI message to Supabase
      if (userId && selectedSessionId) {
        supabase.schema("chat").from("messages").insert({
          id: aiMsg.id,
          session_id: selectedSessionId,
          auth_user_id: userId,
          sender: "ai",
          content: responseContent,
        }).then(({ error: err }) => {
          if (err) console.error("[AI Msg] Insert failed:", err);
        });
      }

      setIsLoading(false);
      setIsThinking(false);

      // Mark event run as done
      setEventRuns((prev) => {
        const runId = activeRunIdRef.current;
        if (!runId || !prev[runId]) return prev;
        return { ...prev, [runId]: { ...prev[runId], status: "done", isExpanded: false } };
      });
      setActiveRunId(null);
    },
    onError: (errMsg: string) => {
      console.error("Agent error:", errMsg);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        text: `Error connecting to agent: ${errMsg}`,
        sender: "ai",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);
      setIsThinking(false);

      setEventRuns((prev) => {
        const runId = activeRunIdRef.current;
        if (!runId || !prev[runId]) return prev;
        return { ...prev, [runId]: { ...prev[runId], status: "done", isExpanded: false } };
      });
      setActiveRunId(null);
    },
    onStreamEnd: () => {
      // Refetch token balance could go here
    },
  });

  // ── Sync agent suggestions ──
  useEffect(() => {
    if (agentSuggestions.length > 0) {
      setSuggestions(agentSuggestions.map((s: string, i: number) => ({
        id: `sug-${i}`,
        text: s,
      })));
    }
  }, [agentSuggestions]);

  // ── Load user data ──
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
          setUserLoadError("Not logged in");
          setUserName("User");
          return;
        }
        setUserId(user.id);

        const profile = await loadUserProfile(user);
        if (profile.name) setUserName(profile.name);
        if (profile.role) setUserRole(profile.role);
        if (profile.teamId) setTeamId(profile.teamId);
      } catch (err) {
        console.error("Failed to load user", err);
        setUserLoadError("Failed to load");
        setUserName("User");
      }
    };
    loadUser();
  }, []);

  // ── Load analysis sessions from Supabase ──
  const fetchSessions = useCallback(async () => {
    if (!userId || !teamId) return;
    setSessionsLoading(true);

    try {
      const { data: sessions, error: sessErr } = await supabase
        .schema("chat")
        .from("sessions")
        .select("id, title, description, created_at, updated_at, auth_user_id")
        .eq("chat_mode", "analysis")
        .eq("status", "active")
        .eq("team_id", teamId)
        .order("updated_at", { ascending: false });

      if (sessErr) throw sessErr;
      if (!sessions || sessions.length === 0) {
        setAnalysisSessions([]);
        setSessionsLoading(false);
        return;
      }

      // Fetch last user message for each session + author names
      const authUserIds = [...new Set(sessions.map((s: any) => s.auth_user_id))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("auth_user_id, full_name")
        .in("auth_user_id", authUserIds);

      const nameMap: Record<string, string> = {};
      for (const p of profiles || []) {
        const parts = (p.full_name || "").trim().split(/\s+/);
        nameMap[p.auth_user_id] = parts[0] || "Unknown";
      }

      // Fetch last user message per session
      const mapped: AnalysisSession[] = [];
      for (const s of sessions) {
        const { data: lastMsg } = await supabase
          .schema("chat")
          .from("messages")
          .select("content")
          .eq("session_id", s.id)
          .eq("sender", "user")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        mapped.push({
          id: s.id,
          title: s.title || "Untitled Analysis",
          description: s.description || "",
          iconIndex: hashIconIndex(s.id),
          authorName: nameMap[s.auth_user_id] || "Unknown",
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          lastUserMessage: lastMsg?.content || null,
        });
      }

      setAnalysisSessions(mapped);
    } catch (err) {
      console.error("Failed to load analysis sessions:", err);
    } finally {
      setSessionsLoading(false);
    }
  }, [userId, teamId]);

  useEffect(() => {
    if (userId && teamId) fetchSessions();
  }, [userId, teamId, fetchSessions]);

  // ── Load messages when selecting a session ──
  const loadMessages = useCallback(async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .schema("chat")
        .from("messages")
        .select("id, content, sender, created_at, pasted_contents")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const msgs: Message[] = (data || []).map((m: any) => ({
        id: m.id,
        text: m.content || "",
        sender: m.sender as "user" | "ai",
        createdAt: m.created_at,
        pastedContents: m.pasted_contents || undefined,
      }));
      setMessages(msgs);
      setEventRuns({});
      setActiveRunId(null);
      setSuggestions([]);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  // ── Select a session ──
  const handleSelectSession = (id: string) => {
    setSelectedSessionId(id);
    lastResponseRef.current = "";
    loadMessages(id);
  };

  // ── Send message ──
  const handleSendMessage = async (pastedContents?: string[]) => {
    if (!chatMessage.trim() && pendingFiles.length === 0 && (!pastedContents || pastedContents.length === 0)) return;
    if (isLoading || !selectedSessionId) return;

    const messageText = chatMessage.trim() || "(Attached files)";

    const pastedItems: PastedContent[] = pastedContents
      ? pastedContents.map((content) => ({ id: crypto.randomUUID(), content }))
      : [];

    const messageId = crypto.randomUUID();

    // Separate image and text files
    const imageFiles: File[] = [];
    const textFiles: File[] = [];
    for (const f of pendingFiles) {
      if (f.type.startsWith("image/")) imageFiles.push(f);
      else textFiles.push(f);
    }

    const imageAttachments: ImageAttachment[] = [];
    for (const img of imageFiles) {
      try {
        const buf = await img.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        imageAttachments.push({
          name: img.name,
          mediaType: img.type || "image/png",
          dataUrl: `data:${img.type || "image/png"};base64,${b64}`,
        });
      } catch (e) {
        console.error(`[Image] Failed to read ${img.name}:`, e);
      }
    }

    const userMessage: Message = {
      id: messageId,
      text: messageText,
      sender: "user",
      createdAt: new Date().toISOString(),
      pastedContents: pastedItems.length > 0 ? pastedItems : undefined,
      images: imageAttachments.length > 0 ? imageAttachments : undefined,
    };

    // Persist user message to Supabase
    if (userId) {
      const { error: msgErr } = await supabase.schema("chat").from("messages").insert({
        id: messageId,
        session_id: selectedSessionId,
        auth_user_id: userId,
        sender: "user",
        content: messageText,
        pasted_contents: pastedItems.length > 0 ? pastedItems : [],
      });
      if (msgErr) console.error("[SendMsg] Failed to insert message:", msgErr);
    }

    // Update local state
    setMessages((prev) => [...prev, userMessage]);
    setChatMessage("");
    setPendingFiles([]);
    setSuggestions([]);

    // Create event run
    setEventRuns((prev) => ({
      ...prev,
      [messageId]: {
        id: messageId,
        userMessageId: messageId,
        events: [],
        status: "streaming",
        isExpanded: true,
      },
    }));
    setActiveRunId(messageId);
    setIsLoading(true);
    setIsThinking(true);

    // Read text files
    const fileTexts: string[] = [];
    for (const file of textFiles) {
      try {
        const text = await file.text();
        fileTexts.push(`[File: ${file.name}]\n${text}`);
      } catch {
        fileTexts.push(`[File: ${file.name}] (could not read)`);
      }
    }

    // Send to agent
    const parts = [messageText];
    if (pastedContents && pastedContents.length > 0) parts.push(...pastedContents);
    if (fileTexts.length > 0) parts.push(...fileTexts);
    const fullMessage = parts.filter(Boolean).join("\n");
    lastResponseRef.current = "";

    const chatImages: ChatImage[] = imageAttachments.map((img) => ({
      mediaType: img.mediaType,
      base64: img.dataUrl.replace(/^data:[^;]+;base64,/, ""),
    }));
    sendToAgent(fullMessage, chatImages.length > 0 ? chatImages : undefined);
  };

  // ── Start from blank — create session immediately ──
  const handleStartFromBlank = async () => {
    if (!userId || !teamId) return;

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.schema("chat").from("sessions").insert({
      id: newId,
      auth_user_id: userId,
      team_id: teamId,
      title: "New Analysis",
      chat_mode: "analysis",
      status: "active",
    });

    if (error) {
      console.error("Failed to create blank session:", error);
      return;
    }

    const newSession: AnalysisSession = {
      id: newId,
      title: "New Analysis",
      description: "",
      iconIndex: hashIconIndex(newId),
      authorName: userName || "User",
      createdAt: now,
      updatedAt: now,
      lastUserMessage: null,
    };

    setAnalysisSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(newId);
    setMessages([]);
    setEventRuns({});
    setActiveRunId(null);
    setSuggestions([]);
    lastResponseRef.current = "";
  };

  // ── Create analysis from modal ──
  const handleCreateAnalysis = async (title: string, description: string, iconIndex: number) => {
    if (!userId || !teamId) return;

    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { error } = await supabase.schema("chat").from("sessions").insert({
      id: newId,
      auth_user_id: userId,
      team_id: teamId,
      title,
      description,
      chat_mode: "analysis",
      status: "active",
    });

    if (error) {
      console.error("Failed to create analysis:", error);
      return;
    }

    const newSession: AnalysisSession = {
      id: newId,
      title,
      description,
      iconIndex,
      authorName: userName || "User",
      createdAt: now,
      updatedAt: now,
      lastUserMessage: null,
    };

    setAnalysisSessions((prev) => [newSession, ...prev]);
    setSelectedSessionId(newId);
    setMessages([]);
    setEventRuns({});
    setActiveRunId(null);
    setSuggestions([]);
    lastResponseRef.current = "";
    setShowCreateModal(false);
  };

  // Toggle event run expand/collapse
  const handleToggleExpand = (runId: string) => {
    setEventRuns((prev) => {
      if (!prev[runId]) return prev;
      return { ...prev, [runId]: { ...prev[runId], isExpanded: !prev[runId].isExpanded } };
    });
  };

  // Handle suggestion click
  const handleSuggestionClick = (text: string) => {
    setChatMessage(text);
  };

  // File attachment
  const handleAttachClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setPendingFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = "";
  };
  const handleRemoveFile = (index: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== index));

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, eventRuns]);

  // Filtered sessions
  const filteredSessions = analysisSessions.filter(
    (s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Build ordered message + event run list
  const chatItems: ({ type: "message"; msg: Message } | { type: "run"; run: EventRun })[] = [];
  for (const msg of messages) {
    chatItems.push({ type: "message", msg });
    if (msg.sender === "user" && eventRuns[msg.id]) {
      chatItems.push({ type: "run", run: eventRuns[msg.id] });
    }
  }

  const handleChangeAgent = () => {
    console.log("Change agent clicked");
  };

  const latestAiId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === "ai") return messages[i].id;
    }
    return null;
  })();

  return (
    <div className="analysis_root">
      <AnalysisHeader
        userName={userName}
        userRole={userRole}
        userError={userLoadError}
        onChangeAgent={handleChangeAgent}
      />

      <main className="analysis_content">
        {/* Left Panel — Session Cards */}
        <div className="analysis_left">
          <div className="analysis_leftHeader">
            <h1 className="analysis_leftTitle">Analysis</h1>
          </div>

          <div className="analysis_search">
            <Search size={16} className="analysis_searchIcon" />
            <input
              type="text"
              className="analysis_searchInput"
              placeholder="Search analyses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="analysis_cardList">
            {sessionsLoading ? (
              <div className="analysis_previewEmpty" style={{ padding: 24 }}>
                <p>Loading sessions...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="analysis_previewEmpty" style={{ padding: 24 }}>
                <p>No analyses yet. Create one to get started.</p>
              </div>
            ) : (
              filteredSessions.map((session) => (
                <AnalysisCardItem
                  key={session.id}
                  session={session}
                  isSelected={selectedSessionId === session.id}
                  onClick={() => handleSelectSession(session.id)}
                />
              ))
            )}
          </div>

          <div className="analysis_leftFooter">
            <button type="button" className="analysis_btnSecondary" onClick={handleStartFromBlank}>
              Start from blank
            </button>
            <button type="button" className="analysis_btnPrimary" onClick={() => setShowCreateModal(true)}>
              Create analysis
            </button>
          </div>
        </div>

        {/* Right Panel — Embedded Chat */}
        <div className={`analysis_right ${selectedSessionId ? "analysis_right--active" : ""}`}>
          {!selectedSessionId ? (
            <div className="analysis_previewEmpty">
              <div className="analysis_previewEmptyIcon">
                <BarChart2 size={48} strokeWidth={1} />
              </div>
              <h3>Select an analysis</h3>
              <p>Choose an analysis from the left panel to start chatting</p>
            </div>
          ) : (
            <>
              {/* Messages area */}
              <div className="dash_chatMessages" style={{ flex: 1, overflowY: "auto", padding: "24px 24px 0" }}>
                {messages.length === 0 && !isLoading && (
                  <div className="analysis_previewEmpty" style={{ height: "100%" }}>
                    <div className="analysis_previewEmptyIcon">
                      <BarChart2 size={48} strokeWidth={1} />
                    </div>
                    <h3>Start your analysis</h3>
                    <p>Send a message to begin the conversation</p>
                  </div>
                )}

                {chatItems.map((item) => {
                  if (item.type === "message") {
                    return (
                      <MessageBubble
                        key={item.msg.id}
                        message={item.msg}
                        isLatestAi={item.msg.id === latestAiId}
                      />
                    );
                  }
                  return (
                    <InlineEventRun
                      key={item.run.id}
                      run={item.run}
                      onToggleExpand={handleToggleExpand}
                    />
                  );
                })}

                {suggestions.length > 0 && !isLoading && (
                  <FollowUpSuggestions
                    suggestions={suggestions}
                    onSelect={handleSuggestionClick}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Chat input */}
              <div style={{ flexShrink: 0, padding: "0 24px 24px" }}>
                <ChatInput
                  value={chatMessage}
                  onChange={setChatMessage}
                  onSubmit={handleSendMessage}
                  placeholder="Ask about this analysis..."
                  disabled={isLoading}
                  isLoading={isLoading}
                  pendingFiles={pendingFiles}
                  onAttachClick={handleAttachClick}
                  onRemoveFile={handleRemoveFile}
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </>
          )}
        </div>
      </main>

      {showCreateModal && (
        <CreateAnalysisModal
          userName={userName}
          onSave={handleCreateAnalysis}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
