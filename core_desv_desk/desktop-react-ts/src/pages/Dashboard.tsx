// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, ArrowUp, Plus, X, ChevronRight, Check, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useThinking } from "../context/Thinkingcontext";

import "../styles/dashboard-ui.css";
import "../styles/theme-dark.css";  
import "../styles/theme-pink.css";
import "../styles/theme-switcher.css";
import "../styles/theme-ocean.css";
import "../styles/theme-forest.css";
import "../styles/theme-sand.css";
import { useAgentChat } from "../components/useAgentChat";
import type { AgentEvent, ChatImage } from "../components/useAgentChat";
import {
  MessageBubble,
  ChatInput,
  InlineEventRun,
  FollowUpSuggestions,
  highlightCode,
  type PastedContent,
  type ImageAttachment,
  type Message,
  type Session,
  type ClarificationQuestion,
  type TimelineEvent,
  type EventRun,
  type FollowUpSuggestion,
} from "../components/ChatComponents";

const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";

// ── Sentinela Agent API ──
const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || 'https://sentinela-909652673285.us-central1.run.app';

// ============================================================================
// PARTICLE GRID - Flashlight hover effect (no thinking pulse)
// ============================================================================

interface ParticleGridProps {
  containerRef: React.RefObject<HTMLDivElement>;
}

function ParticleGrid({ containerRef }: ParticleGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const targetRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number | null>(null);
  const isInsideRef = useRef(false);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SPACING = 24;
    const BASE_ALPHA = 0.04;
    const HOVER_RADIUS = 200;
    const HOVER_PEAK = 0.28;

    let gx: number[] = [];
    let gy: number[] = [];

    const setup = () => {
      const r = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width: r.width, height: r.height };
      gx = []; gy = [];
      for (let x = SPACING; x < r.width; x += SPACING)
        for (let y = SPACING; y < r.height; y += SPACING) { gx.push(x); gy.push(y); }
    };

    setup();

    const onMove = (e: MouseEvent) => {
      const r = container.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      isInsideRef.current = x >= 0 && x <= r.width && y >= 0 && y <= r.height;
      targetRef.current = isInsideRef.current ? { x, y } : { x: -1000, y: -1000 };
    };
    const onLeave = () => { isInsideRef.current = false; targetRef.current = { x: -1000, y: -1000 }; };

    window.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", setup);

    const draw = () => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse follow
      mouseRef.current.x += (targetRef.current.x - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (targetRef.current.y - mouseRef.current.y) * 0.08;
      const mx = mouseRef.current.x, my = mouseRef.current.y;

      const n = gx.length;
      for (let i = 0; i < n; i++) {
        const px = gx[i], py = gy[i];
        let a = BASE_ALPHA;

        // Hover: smooth radial glow
        if (isInsideRef.current) {
          const d = Math.hypot(px - mx, py - my);
          if (d < HOVER_RADIUS) {
            const t = 1 - d / HOVER_RADIUS;
            a = Math.max(a, t * t * HOVER_PEAK);
          }
        }

        if (a > 0.015) {
          ctx.globalAlpha = a;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(px, py, 1, 0, 6.283);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", setup);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [containerRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

// ============================================================================
// THINKING OVERLAY - Spinning icon + rotating status messages
// ============================================================================

const THINKING_MESSAGES = [
  "Thinking",
  "Connecting to systems",
  "Processing request",
  "Analyzing data",
  "Creating response",
  "Performing analysis",
  "Reasoning",
  "Evaluating context",
  "Synthesizing",
  "Generating insights",
  "Exploring possibilities",
  "Building answer",
];

function ThinkingOverlay({ isActive }: { isActive: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    if (!isActive) { setMsgIndex(0); setFade(true); return; }

    // Pick a random starting index
    setMsgIndex(Math.floor(Math.random() * THINKING_MESSAGES.length));
    setFade(true);

    const interval = setInterval(() => {
      setFade(false); // fade out
      setTimeout(() => {
        setMsgIndex(prev => (prev + 1) % THINKING_MESSAGES.length);
        setFade(true); // fade in
      }, 300);
    }, 2400);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="dash_thinkingOverlay">
      <div className="dash_thinkingSpinner">
        <Loader2 size={16} />
      </div>
      <span className={`dash_thinkingMsg ${fade ? "dash_thinkingMsg--in" : "dash_thinkingMsg--out"}`}>
        {THINKING_MESSAGES[msgIndex]}
      </span>
    </div>
  );
}

// ============================================================================
// HITL WIZARD - Clarification questions with wizard flow
// ============================================================================

interface HITLWizardProps {
  questions: ClarificationQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  onAnswer: (questionId: string, answer: string) => void;
  onSkip: (questionId: string) => void;
  onComplete: () => void;
}

function HITLWizard({ 
  questions, 
  currentIndex, 
  onAnswer, 
  onSkip,
  onComplete 
}: HITLWizardProps) {
  const [textAnswer, setTextAnswer] = useState("");
  
  if (questions.length === 0) return null;
  
  // Check if all questions answered
  if (currentIndex >= questions.length) {
    return (
      <div className="dash_hitlComplete">
        <div className="dash_hitlCompleteIcon">
          <Check size={24} />
        </div>
        <p>All questions answered</p>
        <button 
          type="button" 
          className="dash_hitlSubmitBtn"
          onClick={onComplete}
        >
          Continue
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }
  
  const currentQ = questions[currentIndex];
  const progress = (currentIndex / questions.length) * 100;
  
  const handleOptionSelect = (value: string) => {
    onAnswer(currentQ.id, value);
  };
  
  const handleTextSubmit = () => {
    if (textAnswer.trim()) {
      onAnswer(currentQ.id, textAnswer.trim());
      setTextAnswer("");
    }
  };
  
  const handleSkip = () => {
    onSkip(currentQ.id);
    setTextAnswer("");
  };
  
  return (
    <div className="dash_hitlWizard">
      <div className="dash_hitlCard">
        <div className="dash_hitlHeader">
          <span className="dash_hitlLabel">
            QUESTION {currentIndex + 1} OF {questions.length}
          </span>
        </div>
        
        <div className="dash_hitlQuestion">
          {currentQ.question}
        </div>
        
        <div className="dash_hitlProgress">
          <span className="dash_hitlProgressLabel">Progress</span>
          <div className="dash_hitlProgressBar">
            <div 
              className="dash_hitlProgressFill" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <span className="dash_hitlProgressCount">
            {currentIndex + 1}/{questions.length}
          </span>
        </div>
        
        {/* Options or text input */}
        {currentQ.options && currentQ.options.length > 0 ? (
          <div className="dash_hitlOptions">
            {currentQ.options.map((option, idx) => (
              <button
                key={option.value}
                type="button"
                className={`dash_hitlOption ${idx === 0 ? "dash_hitlOption--primary" : ""}`}
                onClick={() => handleOptionSelect(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="dash_hitlTextInput">
            <textarea
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="dash_hitlTextarea"
              rows={3}
            />
            <div className="dash_hitlTextActions">
              <button
                type="button"
                className="dash_hitlContinueBtn"
                onClick={handleTextSubmit}
                disabled={!textAnswer.trim()}
              >
                Continue
              </button>
              <button
                type="button"
                className="dash_hitlSkipBtn"
                onClick={handleSkip}
              >
                Skip question
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="dash_hitlLegend">Sentinela will continue after your answer</p>
    </div>
  );
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

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ChevronUpDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15l5 5 5-5" />
      <path d="M7 9l5-5 5 5" />
    </svg>
  );
}

// ============================================================================
// SESSION SELECTOR
// ============================================================================

interface SessionSelectorProps {
  sessions: Session[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onViewAll?: () => void;
}

function SessionSelector({ sessions, currentSessionId, onSelectSession, onViewAll }: SessionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const MAX_VISIBLE = 3;
  const visibleSessions = sessions.slice(0, MAX_VISIBLE);
  const hasMore = sessions.length > MAX_VISIBLE;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="dash_sessionSelector" ref={dropdownRef}>
      <span className="dash_sessionLabel">Session /</span>
      <button
        type="button"
        className="dash_sessionTrigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{currentSession?.title || "Welcome"}</span>
        <ChevronUpDownIcon />
      </button>
      
      {isOpen && (
        <div className="dash_sessionMenu">
          {visibleSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`dash_sessionItem ${session.id === currentSessionId ? "is-selected" : ""}`}
              onClick={() => {
                onSelectSession(session.id);
                setIsOpen(false);
              }}
            >
              <span className="dash_sessionItemTitle">{session.title}</span>
              <span className="dash_sessionItemMeta">
                {session.messages.length} message{session.messages.length !== 1 ? "s" : ""}
              </span>
            </button>
          ))}
          {hasMore && onViewAll && (
            <button
              type="button"
              className="dash_sessionViewAll"
              onClick={() => {
                setIsOpen(false);
                onViewAll();
              }}
            >
              View all ({sessions.length})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DROPDOWN SELECT
// ============================================================================

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  label: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
}

function DropdownSelect({ label, value, options, onChange }: DropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="dash_dropdownGroup">
      <span className="dash_dropdownLabel">{label}</span>
      <div className="dash_dropdownWrapper" ref={dropdownRef}>
        <button
          type="button"
          className="dash_dropdownTrigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedOption?.label || value}</span>
          <ChevronUpDownIcon />
        </button>
        
        {isOpen && (
          <div className="dash_dropdownMenu">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`dash_dropdownItem ${option.value === value ? "is-selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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

  if (profileData?.active_team_id) {
    teamId = profileData.active_team_id;

    const { data: membershipData } = await supabase
      .from("team_memberships")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("team_id", profileData.active_team_id)
      .maybeSingle();

    if (membershipData?.role) {
      role = membershipData.role;
    }
  }

  return { name: baseName, role, teamId };
}

// ============================================================================
// DASHBOARD HEADER
// ============================================================================

interface DashboardHeaderProps {
  userName: string;
  userRole?: string | null;
  userError?: string | null;
  currentPage?: string;
  credits: number;
  maxCredits: number;
  onChangeAgent?: () => void;
  titleBarVisible?: boolean;
  headerMinimal?: boolean;
  onToggleTitleBar?: () => void;
}

function DashboardHeader({ 
  userName, 
  userRole, 
  userError,
  currentPage = "Home",
  credits,
  maxCredits,
  onChangeAgent,
  //titleBarVisible = true,
  headerMinimal = false,
  onToggleTitleBar 
}: DashboardHeaderProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(LS_KEY) === "1";
    } catch {
      return false;
    }
  });
  
  // Credits modal state
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

      try {
        localStorage.setItem(LS_KEY, next ? "1" : "0");
      } catch {}

      if (next) document.documentElement.classList.add(ROOT_COLLAPSED_CLASS);
      else document.documentElement.classList.remove(ROOT_COLLAPSED_CLASS);

      window.dispatchEvent(
        new CustomEvent("cora:sidebar-toggle", { detail: { collapsed: next } })
      );

      return next;
    });
  }, []);
  
  const handleSendRequest = () => {
    // Here you would send the email request
    console.log("Token request:", { subject: emailSubject, context: emailContext });
    // Reset form and close modal
    setEmailSubject("");
    setEmailContext("");
    setShowCreditsModal(false);
    // Show success feedback (could add a toast here)
    alert("Request sent! We'll get back to you shortly.");
  };
  // ─── Theme System ───
  type ThemeMode = "light" | "dark" | "pink" | "ocean" | "forest" | "sand";

  const CUSTOM_THEMES: { id: ThemeMode; label: string; colors: string[] }[] = [
    { id: "pink", label: "Variant 1", colors: ["#fb6f92", "#ffc8d6", "#ffecf1"] },
    { id: "ocean", label: "Variant 2", colors: ["#14365a", "#1a4570", "#8aaec8"] },
    { id: "forest", label: "Variant 3", colors: ["#1a3a38", "#4a8a7a", "#c8dcc4"] },
    { id: "sand", label: "Variant 4", colors: ["#c4a882", "#dcc8b0", "#f0e8de"] },
  ];

  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("cora.theme");
    return (saved as ThemeMode) || "light";
  });

  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("cora.theme", theme);
  }, [theme]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    if (showThemeMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showThemeMenu]);

  const isCustomTheme = theme !== "light" && theme !== "dark";
  const isDark = theme === "dark";

  const toggleLightDark = () => {
    setTheme(isDark ? "light" : "dark");
    setShowThemeMenu(false);
  };

  const displayName = (userName || "").trim() || "User";
  const displayRole = userRole || null;
  const creditsPercentage = (credits / maxCredits) * 100;

  return (
    <>
      <header className={`dash_header ${headerMinimal ? "dash_header--minimal" : ""}`}>
        <div className="dash_headerLeft">
          <button
            type="button"
            onClick={toggleSidebar}
            className="dash_menuBtn"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={18} />
          </button>

          <button
            type="button"
            onClick={onToggleTitleBar}
            className="dash_menuBtn"
            aria-label="Toggle header mode"
            title="Cambiar modo de header"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5" r="1" />
              <circle cx="12" cy="12" r="1" />
              <circle cx="12" cy="19" r="1" />
            </svg>
          </button>

          {!headerMinimal && (
            <>
              <div className="dash_headerDivider" />

              <div className="dash_userInfo">
                <span className="dash_pageName">{currentPage}</span>
                <span className="dash_pathSeparator">/</span>
                <span className="dash_userName">{displayName}</span>
                {displayRole && (
                  <>
                    <span className="dash_userSeparator">/</span>
                    <span className="dash_userRole">{displayRole}</span>
                  </>
                )}
              </div>
              {userError && <span className="dash_userError">({userError})</span>}
              
              {/* Credits Bar */}
              <div className="dash_creditsContainer">
                <div className="dash_creditsBar">
                  <div 
                    className="dash_creditsFill" 
                    style={{ width: `${creditsPercentage}%` }}
                  />
                </div>
                <span className="dash_creditsText">
                  {credits.toLocaleString()} Credits Left
                </span>
                <button 
                  type="button" 
                  className="dash_creditsAddBtn"
                  onClick={() => setShowCreditsModal(true)}
                  aria-label="Request more credits"
                >
                  <Plus size={14} />
                </button>
              </div>
            </>
          )}
        </div>

        {!headerMinimal && (
          <div className="dash_headerRight">
          <button 
            type="button" 
            className="dash_changeAgentBtn"
            onClick={onChangeAgent}
          >
            <AgentIcon />
            <span>Change agent</span>
          </button>
          
          <div className="dash_headerDivider" />
          
          <button type="button" className="dash_headerBtn">
            Feedback
          </button>
            
          {/* Theme controls */}
          <div className="dash_themeControls" ref={themeMenuRef}>
            {/* Light/Dark toggle switch */}
            <button
              type="button"
              className={`dash_themeSwitch ${isDark || isCustomTheme ? "" : "is-light"}`}
              onClick={toggleLightDark}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Modo claro" : "Modo oscuro"}
            >
              <svg className="dash_themeSwitchIcon dash_themeSwitchIcon--sun" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <svg className="dash_themeSwitchIcon dash_themeSwitchIcon--moon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span className="dash_themeSwitchThumb" />
            </button>

            {/* Custom theme button */}
            <button
              type="button"
              className={`dash_themeCustomBtn ${isCustomTheme ? "is-active" : ""}`}
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              aria-label="Custom themes"
              title="Temas personalizados"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="10.5" r="2.5" />
                <circle cx="8.5" cy="7.5" r="2.5" />
                <circle cx="6.5" cy="12.5" r="2.5" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </button>

            {/* Dropdown */}
            {showThemeMenu && (
              <div className="dash_themeDropdown">
                <div className="dash_themeDropdownLabel">Custom Themes</div>
                {CUSTOM_THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`dash_themeDropdownItem ${theme === t.id ? "is-active" : ""}`}
                    onClick={() => { setTheme(t.id); setShowThemeMenu(false); }}
                  >
                    <span className="dash_themeSwatches">
                      {t.colors.map((c, i) => (
                        <span key={i} className="dash_themeSwatch" style={{ background: c }} />
                      ))}
                    </span>
                    <span>{t.label}</span>
                    {theme === t.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto" }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>


          <button type="button" className="dash_headerBtn">
            Docs
          </button>
        </div>
        )}
      </header>
      
      {/* Credits Request Modal */}
      {showCreditsModal && (
        <div className="dash_modalOverlay" onClick={() => setShowCreditsModal(false)}>
          <div className="dash_creditsModal" onClick={(e) => e.stopPropagation()}>
            <div className="dash_creditsModalHeader">
              <h2>Request More Tokens</h2>
              <button 
                type="button" 
                className="dash_creditsModalClose"
                onClick={() => setShowCreditsModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="dash_creditsModalDesc">
              Need more tokens? Send us an email with the context of your request and we'll get back to you shortly.
            </p>
            
            <div className="dash_creditsModalForm">
              <div className="dash_creditsModalField">
                <label htmlFor="email-subject">Subject</label>
                <input 
                  id="email-subject"
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g., Request for additional research tokens"
                />
              </div>
              
              <div className="dash_creditsModalField">
                <label htmlFor="email-context">Context of your request</label>
                <textarea 
                  id="email-context"
                  value={emailContext}
                  onChange={(e) => setEmailContext(e.target.value)}
                  placeholder="Please describe why you need additional tokens and how you plan to use them..."
                  rows={4}
                />
              </div>
              
              <div className="dash_creditsModalActions">
                <button 
                  type="button" 
                  className="dash_creditsModalCancel"
                  onClick={() => setShowCreditsModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="dash_creditsModalSubmit"
                  onClick={handleSendRequest}
                  disabled={!emailSubject.trim() || !emailContext.trim()}
                >
                  Send Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// DASHBOARD PAGE
// ============================================================================

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  // Token balance
  const [totalTokens, setTotalTokens] = useState(10000);
  const [remainingTokens, setRemainingTokens] = useState(10000);
  
  // Dashboard stats (from chat.get_dashboard_stats)
  const [dashStats, setDashStats] = useState({
    notifications: 0,
    currentWorks: 0,
    activeTasks: 0,
  });
  
  // Settings dropdowns
  const [focusedOn, setFocusedOn] = useState("research");
  const [chatMode, setChatMode] = useState("chat");
  const [selectedLlm, setSelectedLlm] = useState("claude-sonnet-4-20250514");
  const [knowledge, setKnowledge] = useState("all");
  
  // Settings collapsed state
  const [settingsCollapsed, setSettingsCollapsed] = useState(false);
  
  // Header display mode: 0 = header visible + titlebar hidden,
  //                      1 = header minimal (transparent, only menu+dots),
  //                      2 = header visible + titlebar visible
  const [headerMode, setHeaderMode] = useState<0 | 1 | 2>(0);
  
  // Sessions state — start with empty, will be populated from Supabase or on first New Chat
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  
  // Chat started (first message sent)
  const [chatStarted, setChatStarted] = useState(false);
  
  // Loading state (AI is thinking) - local state
  const [isLoading, setIsLoading] = useState(false);
  
  // Left panel messages for agent mode (includes both user and AI)
  interface LeftPanelMessage {
    id: string;
    text: string;
    sender: "user" | "ai";
    pastedContents?: PastedContent[];
  }
  const [leftPanelMessages, setLeftPanelMessages] = useState<LeftPanelMessage[]>([]);
  const [currentTypingText, setCurrentTypingText] = useState<string>("");
  const [showPastedModalInChat, setShowPastedModalInChat] = useState<{messageId: string, pasteIndex: number} | null>(null);
  
  // Code panel state (for Code mode)
  const [codeContent, setCodeContent] = useState<string>("");
  const [codeLanguage, setCodeLanguage] = useState<string>("");
  
  // Event runs state (inline events per user message)
  const [eventRuns, setEventRuns] = useState<Record<string, EventRun>>({});
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  
  // HITL Wizard state
  const [hitlQuestions, setHitlQuestions] = useState<ClarificationQuestion[]>([]);
  const [hitlCurrentIndex, setHitlCurrentIndex] = useState(0);
  const [hitlAnswers, setHitlAnswers] = useState<Record<string, string>>({});
  const [showHitlWizard, setShowHitlWizard] = useState(false);
  
  // Follow-up suggestions state
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>([]);
  
  // Global thinking context (for sidebar eyes)
  const { setIsThinking } = useThinking();
  
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const leftPanelMessagesRef = useRef<HTMLDivElement>(null);

  // Dedup ref to prevent double AI message insertion
  const lastResponseRef = useRef<string>('');

  // ── Voice mode audio playback (progressive blob rebuild) ──
  // Play after FIRST_PLAY_CHUNKS arrive; when that partial audio ends (or
  // when audio_done fires), rebuild a full blob, seek to where we left off,
  // and continue.  No MediaSource — just plain Audio + Blob.
  const FIRST_PLAY_CHUNKS = 3;
  const decodedChunksRef = useRef<Uint8Array[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const streamDoneRef = useRef(false);
  const chunkCountRef = useRef(0);
  const lastBuildCountRef = useRef(0);   // chunks included in current blob
  const waitingForDataRef = useRef(false); // partial ended, waiting for chunks
  const resumeTimeRef = useRef(0);         // where to seek after rebuild
  const buildAndPlayRef = useRef<((t: number) => void) | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const stopAudio = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.onended = null;
      audioElRef.current.onerror = null;
      audioElRef.current.onloadedmetadata = null;
      audioElRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    decodedChunksRef.current = [];
    streamDoneRef.current = false;
    chunkCountRef.current = 0;
    lastBuildCountRef.current = 0;
    waitingForDataRef.current = false;
    resumeTimeRef.current = 0;
    setIsPlayingAudio(false);
  }, []);

  // Merge all decoded chunks → Blob → Audio → seek → play
  const buildAndPlay = useCallback((seekTime: number) => {
    const chunks = decodedChunksRef.current;
    if (chunks.length === 0) return;

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    console.log(`[Audio] buildAndPlay: ${chunks.length} chunks, ${totalLen} bytes, seek=${seekTime.toFixed(2)}s`);

    const merged = new Uint8Array(totalLen);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    lastBuildCountRef.current = chunks.length;
    waitingForDataRef.current = false;

    // Tear down previous element
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.onended = null;
      audioElRef.current.onerror = null;
      audioElRef.current.onloadedmetadata = null;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);

    const blob = new Blob([merged], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;

    const audio = new Audio(url);
    audio.volume = 1.0;
    audioElRef.current = audio;
    setIsPlayingAudio(true);

    // When this (possibly partial) blob finishes playing:
    audio.onended = () => {
      const available = decodedChunksRef.current.length;
      if (streamDoneRef.current && available <= lastBuildCountRef.current) {
        // All data played through — truly done
        console.log('[Audio] Playback fully complete');
        setIsPlayingAudio(false);
        if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
        audioElRef.current = null;
      } else if (available > lastBuildCountRef.current) {
        // More chunks arrived since last build — rebuild and continue
        console.log(`[Audio] Partial ended — rebuilding (${lastBuildCountRef.current}→${available} chunks)`);
        buildAndPlayRef.current?.(audio.currentTime);
      } else {
        // No new chunks yet, stream not done — park and wait
        console.log('[Audio] Waiting for more data...');
        waitingForDataRef.current = true;
        resumeTimeRef.current = audio.currentTime;
      }
    };

    audio.onerror = () => {
      console.error('[Audio] Error:', audio.error?.code, audio.error?.message);
      setIsPlayingAudio(false);
    };

    if (seekTime > 0) {
      audio.onloadedmetadata = () => {
        audio.currentTime = Math.min(seekTime, audio.duration || seekTime);
        audio.play().catch(() => setIsPlayingAudio(false));
      };
    } else {
      audio.play()
        .then(() => console.log('[Audio] Playing'))
        .catch(err => { console.error('[Audio] Play failed:', err); setIsPlayingAudio(false); });
    }
  }, []);

  // Stable ref so onended can always call the latest buildAndPlay
  buildAndPlayRef.current = buildAndPlay;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { stopAudio(); };
  }, [stopAudio]);

  // Keep activeRunIdRef in sync (for use inside SSE callbacks)
  useEffect(() => { activeRunIdRef.current = activeRunId; }, [activeRunId]);

  // ── Refetch token balance from Supabase (source of truth) ──
  const refetchTokenBalance = useCallback(async () => {
    if (!userId || !teamId) return;
    try {
      const { data, error: err } = await supabase
        .schema("chat")
        .from("token_balances")
        .select("total_tokens, used_tokens, reserved_tokens")
        .eq("auth_user_id", userId)
        .eq("team_id", teamId)
        .single();

      if (err) {
        console.error("[Tokens] Refetch failed:", err);
        return;
      }
      if (data) {
        const remaining = data.total_tokens - data.used_tokens - (data.reserved_tokens || 0);
        console.log(`[Tokens] Refetched from Supabase: total=${data.total_tokens}, remaining=${remaining}`);
        setTotalTokens(data.total_tokens);
        setRemainingTokens(remaining);
      }
    } catch (e) {
      console.error("[Tokens] Refetch error:", e);
    }
  }, [userId, teamId]);

  // ── Sentinela Agent SSE Hook ──
  const {
    sendMessage: sendToAgent,
    confirmAnswers,
    //events: agentEvents,
    //response: agentResponse,
    suggestions: agentSuggestions,
    questions: agentQuestions,
    //isStreaming,
    //error: agentError,
  } = useAgentChat({
    apiUrl: AGENT_API_URL,
    userId: userId || undefined,
    userName: userName || 'Usuario',
    interactionMode: chatMode,
    llmModel: selectedLlm,
    onEvent: (evt: AgentEvent) => {
      // Skip SSE token events — we refetch from Supabase on stream end
      if (evt.type === 'tokens') return;

      const timelineEvt: TimelineEvent = {
        id: crypto.randomUUID(),
        node: evt.source.toUpperCase().replace('_NODE', '').replace('_', ' '),
        message: evt.content,
        timestamp: evt.timestamp,
      };

      setEventRuns(prev => {
        const runId = activeRunIdRef.current;
        if (!runId || !prev[runId]) return prev;
        return {
          ...prev,
          [runId]: { ...prev[runId], events: [...prev[runId].events, timelineEvt] },
        };
      });
    },
    onResponse: (responseContent: string) => {
      // Ref-based dedup: prevent double message insertion
      if (lastResponseRef.current === responseContent) return;
      lastResponseRef.current = responseContent;

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        text: responseContent,
        sender: "ai",
        createdAt: new Date().toISOString(),
      };
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, aiMsg] }
          : session
      ));
      // Persist AI message to Supabase
      if (userId) {
        supabase.schema("chat").from("messages").insert({
          id: aiMsg.id,
          session_id: currentSessionId,
          auth_user_id: userId,
          sender: "ai",
          content: responseContent,
        }).then(({ error: err }) => {
          if (err) console.error("[AI Msg] Insert failed:", err);
        });
      }
      // Handle agent mode typewriter
      if (chatMode === "agent") {
        typewriterEffect(responseContent, aiMsg.id);
      } else if (chatMode === "code") {
        const codeMatch = responseContent.match(/```(\w+)?\n([\s\S]*?)```/);
        if (codeMatch) {
          setCodeLanguage(codeMatch[1] || "plaintext");
          setCodeContent(codeMatch[2].trim());
        }
      }
      setIsLoading(false);
      setIsThinking(false);
      // Mark event run as done and auto-collapse
      setEventRuns(prev => {
        const runId = activeRunIdRef.current;
        if (!runId || !prev[runId]) return prev;
        return { ...prev, [runId]: { ...prev[runId], status: "done", isExpanded: false } };
      });
      setActiveRunId(null);
    },
    onError: (errMsg: string) => {
      console.error("Agent error:", errMsg);
      const errorAiMsg: Message = {
        id: crypto.randomUUID(),
        text: `Error connecting to agent: ${errMsg}`,
        sender: "ai",
        createdAt: new Date().toISOString(),
      };
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, errorAiMsg] }
          : session
      ));
      setIsLoading(false);
      setIsThinking(false);
      // Mark event run as done on error
      setEventRuns(prev => {
        const runId = activeRunIdRef.current;
        if (!runId || !prev[runId]) return prev;
        return { ...prev, [runId]: { ...prev[runId], status: "done", isExpanded: false } };
      });
      setActiveRunId(null);
    },
    onAudioChunk: (rawB64: string) => {
      chunkCountRef.current++;
      console.log(`[Audio] chunk #${chunkCountRef.current}, b64 len=${rawB64.length}`);

      // Decode base64 → Uint8Array immediately
      try {
        const b64 = rawB64.replace(/[\s\r\n]+/g, '');
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
        decodedChunksRef.current.push(bytes);
      } catch (e) {
        console.error('[Audio] base64 decode error:', e);
        return;
      }

      // Start playback once we have enough chunks for a smooth start
      if (chunkCountRef.current === FIRST_PLAY_CHUNKS) {
        buildAndPlay(0);
      }

      // If audio ended and was waiting for data, resume now
      if (waitingForDataRef.current) {
        buildAndPlay(resumeTimeRef.current);
      }
    },
    onAudioDone: () => {
      console.log(`[Audio] done — ${chunkCountRef.current} chunks total`);
      streamDoneRef.current = true;

      if (chunkCountRef.current === 0) return;

      // Haven't started playing yet (fewer than FIRST_PLAY_CHUNKS) → play now
      if (!audioElRef.current) {
        buildAndPlay(0);
        return;
      }

      // Was waiting for data after partial ended → resume with full data
      if (waitingForDataRef.current) {
        buildAndPlay(resumeTimeRef.current);
        return;
      }

      // Currently playing but more chunks arrived since last build → rebuild
      if (decodedChunksRef.current.length > lastBuildCountRef.current) {
        buildAndPlay(audioElRef.current.currentTime);
      }
      // else: current blob already has all data, onended will clean up
    },
    onStreamEnd: () => {
      // Always refetch real token balance from Supabase after stream ends
      refetchTokenBalance();
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

  // ── Sync agent HITL questions ──
  useEffect(() => {
    if (agentQuestions.length > 0) {
      const mapped: ClarificationQuestion[] = agentQuestions.map((q: any, i: number) => ({
        id: `q${i}`,
        question: typeof q === 'string' ? q : (q.question || ''),
        type: (q.options && q.options.length > 0) ? "choice" as const : "text" as const,
        options: q.options?.map((opt: any) => ({
          label: typeof opt === 'string' ? opt : opt.label,
          value: typeof opt === 'string' ? opt : opt.value,
        })),
      }));
      setHitlQuestions(mapped);
      setHitlCurrentIndex(0);
      setHitlAnswers({});
      setShowHitlWizard(true);
      setIsLoading(false);
      setIsThinking(false);
    }
  }, [agentQuestions]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom button state
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Current session (may be null if no sessions loaded yet)
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0] || null;

  // Dropdown options
  const focusOptions: DropdownOption[] = [
    { value: "research", label: "Research" },
    { value: "development", label: "Development" },
    { value: "analysis", label: "Analysis" },
    { value: "documentation", label: "Documentation" },
    { value: "troubleshooting", label: "Troubleshooting" },
  ];

  const modeOptions: DropdownOption[] = [
    { value: "chat", label: "Chat" },
    { value: "voice", label: "Voice" },
    { value: "code", label: "Code" },
    { value: "agent", label: "Agent" },
  ];
  // Note: These values are sent as interaction_mode to the agent API.
  // The agent uses interaction_mode to adjust response style:
  //   "chat" = normal, "agent" = concise, "voice" = short/spoken, "code" = code-focused

  const llmOptions: DropdownOption[] = [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gemini-2.0-flash", label: "Gemini Flash" },
  ];

  const knowledgeOptions: DropdownOption[] = [
    { value: "all", label: "All" },
    { value: "specific", label: "Specific tables" },
    { value: "add", label: "+ Add new" },
  ];

  // Scroll to bottom when messages change
  useEffect(() => {
    if (currentSession && currentSession.messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession?.messages.length]);

  // Auto-scroll when new events stream in
  const activeRunEvents = activeRunId ? eventRuns[activeRunId]?.events : undefined;
  useEffect(() => {
    if (activeRunId && activeRunEvents && activeRunEvents.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeRunEvents?.length, activeRunId]);
  
  // Detect scroll position to show/hide scroll button
  useEffect(() => {
    const messagesArea = messagesAreaRef.current;
    if (!messagesArea) return;
    
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = messagesArea;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      // Show button if scrolled up more than 100px from bottom
      setShowScrollButton(distanceFromBottom > 100);
    };
    
    messagesArea.addEventListener('scroll', handleScroll);
    return () => messagesArea.removeEventListener('scroll', handleScroll);
  }, [chatStarted, currentSession?.messages.length]);
  
  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Toggle expand/collapse for inline event runs
  const handleToggleEventRun = useCallback((runId: string) => {
    setEventRuns(prev => {
      if (!prev[runId]) return prev;
      return {
        ...prev,
        [runId]: { ...prev[runId], isExpanded: !prev[runId].isExpanded },
      };
    });
  }, []);

  // File handling
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setPendingFiles((prev) => [...prev, ...filesArray]);
    e.target.value = "";
  };

  const handleRemoveFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeAgent = () => {
    console.log("Change agent clicked");
  };

  // Stop the AI from thinking
  const handleStopThinking = () => {
    setIsLoading(false);
    setIsThinking(false);
    setEventRuns({}); setActiveRunId(null);
    setShowHitlWizard(false);
    setCurrentTypingText("");
  };

  const toggleSettings = () => {
    setSettingsCollapsed(prev => !prev);
  };

  const handleNewChat = async () => {
    const newSessionId = crypto.randomUUID();
    const newSession: Session = {
      id: newSessionId,
      title: `Chat ${sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      messages: [],
    };
    
    // Persist to Supabase
    if (userId && teamId) {
      const { error } = await supabase.schema("chat").from("sessions").insert({
        id: newSessionId,
        auth_user_id: userId,
        team_id: teamId,
        title: newSession.title,
        focused_on: focusedOn,
        chat_mode: chatMode,
        llm_model: selectedLlm,
        knowledge: knowledge,
      });
      if (error) console.error("[NewChat] Failed to create session:", error);
    }
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setChatStarted(false);
    setLeftPanelMessages([]);
    setCurrentTypingText("");
    
    // Clear Timeline, HITL and Suggestions
    setEventRuns({}); setActiveRunId(null);
    setHitlQuestions([]);
    setHitlCurrentIndex(0);
    setHitlAnswers({});
    setShowHitlWizard(false);
    setSuggestions([]);
    setCodeContent("");
    setCodeLanguage("");
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    setChatStarted((session?.messages.length || 0) > 0);
    setLeftPanelMessages([]);
    setCurrentTypingText("");
    
    // Clear Timeline, HITL and Suggestions when switching sessions
    setEventRuns({}); setActiveRunId(null);
    setHitlQuestions([]);
    setHitlCurrentIndex(0);
    setHitlAnswers({});
    setShowHitlWizard(false);
    setSuggestions([]);
    setCodeContent("");
    setCodeLanguage("");
  };

  useEffect(() => {
    let alive = true;

    const loadUser = async () => {
      setUserLoadError(null);

      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      if (error) {
        setUserLoadError("Could not load user");
        return;
      }

      const user = data?.user;
      if (!user) {
        setUserLoadError("Not authenticated");
        return;
      }

      setUserId(user.id);

      try {
        const profile = await loadUserProfile(user);
        if (!alive) return;

        setUserName(profile.name);
        setUserRole(profile.role);
        setTeamId(profile.teamId);

        if (!profile.teamId) return;

        // Load token balance from chat schema
        const { data: balanceData, error: balanceErr } = await supabase
          .schema("chat")
          .rpc("get_token_balance", {
            p_auth_user_id: user.id,
            p_team_id: profile.teamId,
          });

        if (balanceErr) console.error("[Init] Token balance error:", balanceErr);
        if (alive && balanceData && balanceData.length > 0) {
          setTotalTokens(balanceData[0].total_tokens);
          setRemainingTokens(balanceData[0].remaining_tokens);
        }

        // Load dashboard stats from chat schema
        const { data: statsData, error: statsErr } = await supabase
          .schema("chat")
          .rpc("get_dashboard_stats", {
            p_auth_user_id: user.id,
            p_team_id: profile.teamId,
          });

        if (statsErr) console.error("[Init] Dashboard stats error:", statsErr);
        if (alive && statsData && statsData.length > 0) {
          setDashStats({
            notifications: Number(statsData[0].unread_notifications) || 0,
            currentWorks: Number(statsData[0].current_works) || 0,
            activeTasks: Number(statsData[0].active_tasks) || 0,
          });
        }

        // Load existing sessions from chat schema
        const { data: sessionsData, error: sessionsErr } = await supabase
          .schema("chat")
          .from("sessions")
          .select("id, title, status, focused_on, chat_mode, llm_model, knowledge, message_count, tokens_used, created_at, updated_at")
          .eq("auth_user_id", user.id)
          .eq("team_id", profile.teamId)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (sessionsErr) console.error("[Init] Sessions load error:", sessionsErr);

        if (alive && sessionsData && sessionsData.length > 0) {
          // Load messages for each session
          const loadedSessions: Session[] = [];
          
          for (const s of sessionsData) {
            const { data: messagesData } = await supabase
              .schema("chat")
              .from("messages")
              .select("id, sender, content, tokens_total, pasted_contents, created_at")
              .eq("session_id", s.id)
              .order("created_at", { ascending: true });

            const messages: Message[] = (messagesData || []).map((m: any) => ({
              id: m.id,
              text: m.content,
              sender: m.sender as "user" | "ai",
              createdAt: m.created_at,
              pastedContents: m.pasted_contents && m.pasted_contents.length > 0
                ? m.pasted_contents
                : undefined,
            }));

            loadedSessions.push({
              id: s.id,
              title: s.title,
              createdAt: s.created_at,
              messages,
            });
          }

          if (alive) {
            setSessions(loadedSessions);

            // Check if we should open a specific session (from Chat History page)
            let targetSessionId: string | null = null;
            try {
              targetSessionId = sessionStorage.getItem("sentinela.continueSessionId");
              sessionStorage.removeItem("sentinela.continueSessionId");
            } catch {}

            const targetSession = targetSessionId
              ? loadedSessions.find(s => s.id === targetSessionId)
              : null;

            if (targetSession) {
              setCurrentSessionId(targetSession.id);
              setChatStarted(targetSession.messages.length > 0);
            } else {
              setCurrentSessionId(loadedSessions[0].id);
              setChatStarted(loadedSessions[0].messages.length > 0);
            }
          }
        } else if (alive) {
          // Check if a session was just created from Chat History
          let targetSessionId: string | null = null;
          try {
            targetSessionId = sessionStorage.getItem("sentinela.continueSessionId");
            sessionStorage.removeItem("sentinela.continueSessionId");
          } catch {}

          const firstId = targetSessionId || crypto.randomUUID();

          // Try to fetch the session if it was created elsewhere
          if (targetSessionId) {
            const { data: existingSession } = await supabase
              .schema("chat")
              .from("sessions")
              .select("id, title, created_at")
              .eq("id", targetSessionId)
              .maybeSingle();

            if (existingSession) {
              setSessions([{
                id: existingSession.id,
                title: existingSession.title,
                createdAt: existingSession.created_at,
                messages: [],
              }]);
              setCurrentSessionId(existingSession.id);
              return;
            }
          }

          // No target — create a first session
          const { error: createErr } = await supabase.schema("chat").from("sessions").insert({
            id: firstId,
            auth_user_id: user.id,
            team_id: profile.teamId,
            title: "Chat 1",
          });
          if (createErr) console.error("[Init] Failed to create first session:", createErr);

          setSessions([{
            id: firstId,
            title: "Chat 1",
            createdAt: new Date().toISOString(),
            messages: [],
          }]);
          setCurrentSessionId(firstId);
        }

      } catch {
        if (alive) setUserLoadError("Error loading profile");
      }
    };

    loadUser();
    return () => {
      alive = false;
    };
  }, []);

  // ── Reload sessions when navigating back to Dashboard (e.g., from History) ──
  useEffect(() => {
    if (!userId || !teamId) return;

    const reloadSessions = async () => {
      let targetSessionId: string | null = null;
      try {
        targetSessionId = sessionStorage.getItem("sentinela.continueSessionId");
        sessionStorage.removeItem("sentinela.continueSessionId");
      } catch {}

      const { data: sessionsData } = await supabase
        .schema("chat")
        .from("sessions")
        .select("id, title, created_at")
        .eq("auth_user_id", userId)
        .eq("team_id", teamId)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (sessionsData && sessionsData.length > 0) {
        const loadedSessions: Session[] = [];
        for (const s of sessionsData) {
          const { data: messagesData } = await supabase
            .schema("chat")
            .from("messages")
            .select("id, sender, content, tokens_total, pasted_contents, created_at")
            .eq("session_id", s.id)
            .order("created_at", { ascending: true });

          loadedSessions.push({
            id: s.id,
            title: s.title,
            createdAt: s.created_at,
            messages: (messagesData || []).map((m: any) => ({
              id: m.id,
              text: m.content,
              sender: m.sender as "user" | "ai",
              createdAt: m.created_at,
              pastedContents: m.pasted_contents?.length > 0 ? m.pasted_contents : undefined,
            })),
          });
        }

        setSessions(loadedSessions);

        if (targetSessionId) {
          const target = loadedSessions.find(s => s.id === targetSessionId);
          if (target) {
            setCurrentSessionId(target.id);
            setChatStarted(target.messages.length > 0);
          }
        }
      }
    };

    reloadSessions();
  }, [userId, teamId, location.key]);

  // ── Realtime: listen for AI messages, token changes, and notification/task updates ──
  useEffect(() => {
    if (!userId || !teamId) return;

    // Capture latest selected session for this subscription instance
    const activeSessionId = currentSessionId;

    // Subscribe to new messages (for AI responses from background sessions)
    const messagesChannel = supabase
      .channel("chat-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "chat",
          table: "messages",
          filter: `auth_user_id=eq.${userId}`,
        },
        (payload: any) => {
          const msg = payload.new;

          // Ignore user echoes
          if (msg.sender === "user") return;

          // Current session AI already handled by SSE onResponse — skip to avoid duplicates
          if (msg.session_id === activeSessionId) return;

          const aiMessage: Message = {
            id: msg.id,
            text: msg.content,
            sender: msg.sender as "user" | "ai",
            createdAt: msg.created_at,
          };

          // Extra dedup by message ID (safety net)
          setSessions((prev) =>
            prev.map((s) =>
              s.id === msg.session_id
                ? s.messages.some((m) => m.id === aiMessage.id)
                  ? s // already exists, skip
                  : { ...s, messages: [...s.messages, aiMessage] }
                : s
            )
          );
        }
      )
      .subscribe();

    // Subscribe to token balance changes
    const tokensChannel = supabase
      .channel("token-balance")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "chat",
          table: "token_balances",
          filter: `auth_user_id=eq.${userId}`,
        },
        (payload: any) => {
          const bal = payload.new;
          setTotalTokens(bal.total_tokens);
          setRemainingTokens(bal.total_tokens - bal.used_tokens - (bal.reserved_tokens || 0));
        }
      )
      .subscribe();

    // Subscribe to notifications & tasks for live stats
    const statsChannel = supabase
      .channel("dashboard-stats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "chat",
          table: "notifications",
          filter: `auth_user_id=eq.${userId}`,
        },
        async () => {
          // Re-fetch stats on any notification change
          const { data } = await supabase
            .schema("chat")
            .rpc("get_dashboard_stats", {
              p_auth_user_id: userId,
              p_team_id: teamId,
            });
          if (data && data.length > 0) {
            setDashStats({
              notifications: Number(data[0].unread_notifications) || 0,
              currentWorks: Number(data[0].current_works) || 0,
              activeTasks: Number(data[0].active_tasks) || 0,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "chat",
          table: "tasks",
          filter: `auth_user_id=eq.${userId}`,
        },
        async () => {
          const { data } = await supabase
            .schema("chat")
            .rpc("get_dashboard_stats", {
              p_auth_user_id: userId,
              p_team_id: teamId,
            });
          if (data && data.length > 0) {
            setDashStats({
              notifications: Number(data[0].unread_notifications) || 0,
              currentWorks: Number(data[0].current_works) || 0,
              activeTasks: Number(data[0].active_tasks) || 0,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(tokensChannel);
      supabase.removeChannel(statsChannel);
    };
  }, [userId, teamId, currentSessionId]); // ← currentSessionId added to fix stale closure

  // Random greetings based on time of day
  // Returns an SVG icon based on time of day
  const getTimeOfDayIcon = () => {
    const hour = new Date().getHours();

    // Madrugada (0-5): Luna llena brillante
    if (hour >= 0 && hour < 5) {
      return (
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="24" r="10" />
          <circle cx="20" cy="20" r="2" opacity="0.3" />
          <circle cx="27" cy="18" r="1.2" opacity="0.25" />
          <circle cx="22" cy="28" r="1.5" opacity="0.2" />
          {/* Stars */}
          <circle cx="8" cy="10" r="0.8" fill="currentColor" opacity="0.5" />
          <circle cx="40" cy="8" r="0.6" fill="currentColor" opacity="0.4" />
          <circle cx="38" cy="38" r="0.7" fill="currentColor" opacity="0.45" />
          <circle cx="10" cy="36" r="0.5" fill="currentColor" opacity="0.35" />
          <circle cx="6" cy="24" r="0.6" fill="currentColor" opacity="0.4" />
          <circle cx="42" cy="22" r="0.5" fill="currentColor" opacity="0.3" />
        </svg>
      );
    }

    // Amanecer (5-7): Sol saliendo con horizonte
    if (hour >= 5 && hour < 7) {
      return (
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Horizon line */}
          <line x1="4" y1="32" x2="44" y2="32" />
          {/* Half sun peeking above horizon */}
          <path d="M14 32 A10 10 0 0 1 34 32" />
          {/* Rays going up */}
          <line x1="24" y1="14" x2="24" y2="18" />
          <line x1="15" y1="17" x2="17" y2="20" />
          <line x1="33" y1="17" x2="31" y2="20" />
          <line x1="10" y1="24" x2="13" y2="25" />
          <line x1="38" y1="24" x2="35" y2="25" />
          {/* Glow lines below horizon */}
          <line x1="8" y1="37" x2="16" y2="37" opacity="0.4" />
          <line x1="32" y1="37" x2="40" y2="37" opacity="0.4" />
          <line x1="18" y1="40" x2="30" y2="40" opacity="0.3" />
        </svg>
      );
    }

    // Mañana/Día (7-17): Sol normal
    if (hour >= 7 && hour < 17) {
      return (
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="24" cy="24" r="7" />
          <line x1="24" y1="5" x2="24" y2="10" />
          <line x1="24" y1="38" x2="24" y2="43" />
          <line x1="7.44" y1="7.44" x2="11.15" y2="11.15" />
          <line x1="36.85" y1="36.85" x2="40.56" y2="40.56" />
          <line x1="5" y1="24" x2="10" y2="24" />
          <line x1="38" y1="24" x2="43" y2="24" />
          <line x1="7.44" y1="40.56" x2="11.15" y2="36.85" />
          <line x1="36.85" y1="11.15" x2="40.56" y2="7.44" />
        </svg>
      );
    }

    // Atardecer (17-20): Sol poniéndose con horizonte
    if (hour >= 17 && hour < 20) {
      return (
        <svg width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {/* Horizon line */}
          <line x1="4" y1="30" x2="44" y2="30" />
          {/* Half sun sinking */}
          <path d="M16 30 A8 8 0 0 1 32 30" />
          {/* Soft rays */}
          <line x1="24" y1="16" x2="24" y2="19" />
          <line x1="16" y1="18" x2="18" y2="21" />
          <line x1="32" y1="18" x2="30" y2="21" />
          <line x1="11" y1="24" x2="14" y2="25" />
          <line x1="37" y1="24" x2="34" y2="25" />
          {/* Clouds / warm glow */}
          <path d="M6 34 Q10 32 14 34" opacity="0.4" />
          <path d="M34 34 Q38 32 42 34" opacity="0.4" />
          <line x1="16" y1="38" x2="32" y2="38" opacity="0.25" />
        </svg>
      );
    }

    // Noche temprana (20-24): Luna creciente
    return (
      <svg width="64" height="64" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* Crescent moon using two arcs */}
        <path d="M28 10 A14 14 0 1 0 28 38 A10 10 0 0 1 28 10" />
        {/* Stars */}
        <circle cx="38" cy="12" r="0.8" fill="currentColor" opacity="0.5" />
        <circle cx="12" cy="10" r="0.6" fill="currentColor" opacity="0.4" />
        <circle cx="40" cy="30" r="0.7" fill="currentColor" opacity="0.45" />
        <circle cx="8" cy="28" r="0.5" fill="currentColor" opacity="0.35" />
        <circle cx="36" cy="42" r="0.6" fill="currentColor" opacity="0.3" />
      </svg>
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    
    const morningGreetings = [
      "Good morning",
      "Rise and shine",
      "Morning",
      "Ready to start",
      "Fresh start",
      "New day ahead",
    ];
    
    const afternoonGreetings = [
      "Good afternoon",
      "Hey there",
      "How's it going",
      "Keep it up",
      "Afternoon",
      "Still going strong",
    ];
    
    const eveningGreetings = [
      "Good evening",
      "Evening",
      "Winding down",
      "Almost there",
      "End of day",
    ];
    
    const nightGreetings = [
      "Working late",
      "Night owl",
      "Burning midnight oil",
      "Late night session",
      "Still at it",
      "Quiet hours",
    ];
    
    let greetings: string[];
    
    if (hour >= 5 && hour < 12) {
      greetings = morningGreetings;
    } else if (hour >= 12 && hour < 18) {
      greetings = afternoonGreetings;
    } else if (hour >= 18 && hour < 22) {
      greetings = eveningGreetings;
    } else {
      greetings = nightGreetings;
    }
    
    // Use a seed based on the day so it stays consistent during the session
    const today = new Date().toDateString();
    const seed = today.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = seed % greetings.length;
    
    return greetings[index];
  };

  const displayName = (userName || "").trim() || "User";

  const stats = [
    { label: "notifications", value: dashStats.notifications },
    { label: "current works", value: dashStats.currentWorks },
    { label: "active tasks", value: dashStats.activeTasks },
  ];

  const handleSendMessage = async (pastedContents?: string[]) => {
    if (!chatMessage.trim() && pendingFiles.length === 0 && (!pastedContents || pastedContents.length === 0)) return;
    if (isLoading) return;

    // Stop any playing audio and reset streaming state for new message
    stopAudio();

    // Check token balance before sending
    if (remainingTokens <= 0) {
      // Add a system message indicating no tokens
      const systemMsg: Message = {
        id: crypto.randomUUID(),
        text: "You've run out of tokens. Please request more to continue.",
        sender: "ai",
        createdAt: new Date().toISOString(),
      };
      setSessions(prev => prev.map(session =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, systemMsg] }
          : session
      ));
      return;
    }
    
    const messageText = chatMessage.trim() || (pastedContents && pastedContents.length > 0 ? "" : "(Attached files)");
    
    // Create pasted content objects
    const pastedItems: PastedContent[] = pastedContents 
      ? pastedContents.map(content => ({
          id: crypto.randomUUID(),
          content
        }))
      : [];

    const messageId = crypto.randomUUID();
    
    // ── Separate image files from text files ──
    const imageFiles: File[] = [];
    const textFiles: File[] = [];
    for (const f of pendingFiles) {
      if (f.type.startsWith('image/')) {
        imageFiles.push(f);
      } else {
        textFiles.push(f);
      }
    }

    // Convert image files → base64 data URLs
    const imageAttachments: ImageAttachment[] = [];
    for (const img of imageFiles) {
      try {
        const buf = await img.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        imageAttachments.push({
          name: img.name,
          mediaType: img.type || 'image/png',
          dataUrl: `data:${img.type || 'image/png'};base64,${b64}`,
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

    // If there's no session in Supabase yet (first message in a local-only session), create it
    if (userId && teamId) {
      // Ensure session exists in DB
      const existingSession = sessions.find(s => s.id === currentSessionId);
      if (existingSession && existingSession.messages.length === 0) {
        const { error: sessionErr } = await supabase.schema("chat").from("sessions").upsert({
          id: currentSessionId,
          auth_user_id: userId,
          team_id: teamId,
          title: existingSession.title,
          focused_on: focusedOn,
          chat_mode: chatMode,
          llm_model: selectedLlm,
          knowledge: knowledge,
        }, { onConflict: "id" });
        if (sessionErr) console.error("[SendMsg] Failed to upsert session:", sessionErr);
      }

      // Persist user message to chat.messages
      const { error: msgErr } = await supabase.schema("chat").from("messages").insert({
        id: messageId,
        session_id: currentSessionId,
        auth_user_id: userId,
        sender: "user",
        content: messageText,
        pasted_contents: pastedItems.length > 0 ? pastedItems : [],
      });
      if (msgErr) console.error("[SendMsg] Failed to insert message:", msgErr);
    }
    
    // Update session with new message (local state)
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId
        ? { ...session, messages: [...session.messages, userMessage] }
        : session
    ));
    
    // If mode is "agent", add user message to left panel
    if (chatMode === "agent") {
      setLeftPanelMessages(prev => [...prev, {
        id: userMessage.id,
        text: messageText,
        sender: "user",
        pastedContents: pastedItems.length > 0 ? pastedItems : undefined,
      }]);
    }
    
    // Mark chat as started
    setChatStarted(true);
    
    // Clear input and suggestions
    setChatMessage("");
    setPendingFiles([]);
    setSuggestions([]);

    // Create a new event run for this message
    setEventRuns(prev => ({
      ...prev,
      [messageId]: {
        id: messageId,
        userMessageId: messageId,
        events: [],
        status: "streaming",
        isExpanded: true,
      }
    }));
    setActiveRunId(messageId);

    // Start loading (AI thinking)
    setIsLoading(true);
    setIsThinking(true);
    
    // Scroll to bottom of left panel
    setTimeout(() => {
      leftPanelMessagesRef.current?.scrollTo({
        top: leftPanelMessagesRef.current.scrollHeight,
        behavior: "smooth"
      });
    }, 100);
    
    // ── Read non-image attached files as text ──
    const fileTexts: string[] = [];
    for (const file of textFiles) {
      try {
        const text = await file.text();
        fileTexts.push(`[File: ${file.name}]\n${text}`);
      } catch {
        fileTexts.push(`[File: ${file.name}] (could not read)`);
      }
    }

    // ── Send to real Sentinela Agent via SSE ──
    const parts = [messageText];
    if (pastedContents && pastedContents.length > 0) {
      parts.push(...pastedContents);
    }
    if (fileTexts.length > 0) {
      parts.push(...fileTexts);
    }
    const fullMessage = parts.filter(Boolean).join("\n");
    lastResponseRef.current = '';

    // Build image payloads for the backend (base64 without data: prefix)
    const chatImages: ChatImage[] = imageAttachments.map(img => ({
      mediaType: img.mediaType,
      base64: img.dataUrl.replace(/^data:[^;]+;base64,/, ''),
    }));
    sendToAgent(fullMessage, chatImages.length > 0 ? chatImages : undefined);
  };
  
  // generateAIResponse removed - handled by SSE onResponse callback
  
  // HITL handlers
  const handleHitlAnswer = (questionId: string, answer: string) => {
    setHitlAnswers(prev => ({ ...prev, [questionId]: answer }));
    setHitlCurrentIndex(prev => prev + 1);
  };
  
  const handleHitlSkip = (questionId: string) => {
    setHitlAnswers(prev => ({ ...prev, [questionId]: "Not answered" }));
    setHitlCurrentIndex(prev => prev + 1);
  };
  
  const handleHitlComplete = async () => {
    setShowHitlWizard(false);
    setIsLoading(true);
    setIsThinking(true);

    // Format answers for the agent
    const answers = hitlQuestions.map(q => ({
      question: q.question,
      answer: hitlAnswers[q.id] || "Not answered",
    }));

    // Send confirmation to real agent via SSE
    await confirmAnswers(answers);
  };
  
  // Handle suggestion click
  const handleSuggestionClick = (text: string) => {
    setChatMessage(text);
    // Optionally auto-send
    // handleSendMessage();
  };
  
  // Typewriter effect for left panel - fixed closure issue
  const typewriterEffect = (text: string, messageId: string) => {
    setCurrentTypingText("");
    let currentIndex = 0;
    
    const interval = setInterval(() => {
      if (currentIndex < text.length) {
        const char = text.charAt(currentIndex);
        setCurrentTypingText(prev => prev + char);
        currentIndex++;
        
        // Auto-scroll while typing
        leftPanelMessagesRef.current?.scrollTo({
          top: leftPanelMessagesRef.current.scrollHeight,
          behavior: "auto"
        });
      } else {
        clearInterval(interval);
        // When done typing, add to messages array and clear current
        setLeftPanelMessages(prev => [...prev, {
          id: messageId,
          text: text,
          sender: "ai"
        }]);
        setCurrentTypingText("");
      }
    }, 25);
  };

  return (
    <div className={`dash_root ${headerMode === 1 ? "dash_root--headerMinimal" : ""}`}>
      <DashboardHeader 
        userName={userName} 
        userRole={userRole}
        userError={userLoadError}
        currentPage="Home"
        credits={remainingTokens}
        maxCredits={totalTokens}
        onChangeAgent={handleChangeAgent}
        titleBarVisible={headerMode === 2}
        headerMinimal={headerMode === 1}
        onToggleTitleBar={() => setHeaderMode(prev => ((prev + 1) % 3) as 0 | 1 | 2)}
      />

      {/* Title bar with Settings, Session Selector, and New Chat button */}
      {headerMode === 2 && <div className="dash_titleBar">
        <div className="dash_titleLeft">
          <div className="dash_titleGroup">
            <div className="dash_titleText">
              <h2 className="dash_pageTitle">Research Hub</h2>
              <p className="dash_pageSubtitle">Powered by Sentinela AI</p>
            </div>
            <button 
              type="button" 
              className={`dash_settingsBtn ${settingsCollapsed ? "is-active" : ""}`}
              onClick={toggleSettings}
              aria-label="Toggle settings"
            >
              <SettingsIcon />
            </button>
          </div>
          
          {/* Session Selector - always visible */}
          <SessionSelector
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={handleSelectSession}
            onViewAll={() => navigate("/chat")}
          />
          
          {/* Settings row - collapsible */}
          {!settingsCollapsed && (
            <>
              <div className="dash_titleDivider" />
              
              <div className="dash_settingsRow">
                <DropdownSelect
                  label="Focused On"
                  value={focusedOn}
                  options={focusOptions}
                  onChange={setFocusedOn}
                />
                
                <div className={isLoading ? "dash_dropdownDisabled" : ""}>
                  <DropdownSelect
                    label="Mode"
                    value={chatMode}
                    options={modeOptions}
                    onChange={isLoading ? () => {} : setChatMode}
                  />
                </div>
                
                <DropdownSelect
                  label="LLM"
                  value={selectedLlm}
                  options={llmOptions}
                  onChange={setSelectedLlm}
                />
                
                <DropdownSelect
                  label="Knowledge"
                  value={knowledge}
                  options={knowledgeOptions}
                  onChange={setKnowledge}
                />
              </div>
            </>
          )}
        </div>
        
        <div className="dash_titleRight">
          <button type="button" className="dash_newChatBtn" onClick={handleNewChat}>
            New chat
            <Plus size={16} />
          </button>
        </div>
      </div>}
      
      <main className={`dash_content dash_content--${chatMode}`}>
        {/* Left black panel - hidden in chat mode */}
        {chatMode !== "chat" && (
          <div className={`dash_left dash_left--${chatMode}`} ref={leftPanelRef}>
            <ParticleGrid containerRef={leftPanelRef} />

            {/* Messages in left panel (Agent mode only) */}
            {chatMode === "agent" && (leftPanelMessages.length > 0 || currentTypingText || isLoading) && (
            <div className="dash_leftResponse" ref={leftPanelMessagesRef}>
              <div className="dash_leftResponseInner">
                {/* All messages (user and AI) */}
                {leftPanelMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`dash_leftMessageItem ${msg.sender === "user" ? "dash_leftMessageItem--user" : "dash_leftMessageItem--ai"}`}
                  >
                    <span className="dash_leftMessagePrefix">
                      {msg.sender === "user" ? "you >" : "sentinela >"}
                    </span>
                    <div className="dash_leftResponseText">
                      {/* Show pasted chips if any */}
                      {msg.pastedContents && msg.pastedContents.length > 0 && (
                        <div className="dash_leftPastedChips">
                          {msg.pastedContents.map((paste, idx) => (
                            <button
                              key={paste.id}
                              type="button"
                              className="dash_leftPastedChip"
                              onClick={() => setShowPastedModalInChat({ messageId: msg.id, pasteIndex: idx })}
                            >
                              PASTED {idx + 1}
                            </button>
                          ))}
                        </div>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}
                
                {/* Currently typing message */}
                {currentTypingText && (
                  <div className="dash_leftMessageItem dash_leftMessageItem--ai dash_leftMessageItem--typing">
                    <span className="dash_leftMessagePrefix">sentinela &gt;</span>
                    <div className="dash_leftResponseText">
                      {currentTypingText}
                      <span className="dash_cursor">|</span>
                    </div>
                  </div>
                )}

                {/* Thinking indicator — inline, at message level */}
                <ThinkingOverlay isActive={isLoading && !currentTypingText} />
              </div>
              
              {/* Modal for viewing pasted content in chat */}
              {showPastedModalInChat && (
                <div className="dash_pastedModalOverlay" onClick={() => setShowPastedModalInChat(null)}>
                  <div className="dash_pastedModal" onClick={(e) => e.stopPropagation()}>
                    <div className="dash_pastedModalHeader">
                      <span>Pasted content {showPastedModalInChat.pasteIndex + 1}</span>
                      <button 
                        type="button" 
                        className="dash_pastedModalClose"
                        onClick={() => setShowPastedModalInChat(null)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="dash_pastedModalContent">
                      {leftPanelMessages
                        .find(m => m.id === showPastedModalInChat.messageId)
                        ?.pastedContents?.[showPastedModalInChat.pasteIndex]?.content || ""}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Code panel (Code mode only) */}
          {chatMode === "code" && codeContent && (
            <div className="dash_codePanel">
              <div className="dash_codePanelHeader">
                <span className="dash_codePanelLang">{codeLanguage}</span>
                <button 
                  type="button" 
                  className="dash_codePanelCopy"
                  onClick={() => navigator.clipboard.writeText(codeContent)}
                >
                  Copy
                </button>
              </div>
              <pre className="dash_codePanelContent">
                <code dangerouslySetInnerHTML={{ __html: highlightCode(codeContent, codeLanguage) }} />
              </pre>
            </div>
          )}
          
          {/* Voice mode audio controls */}
          {chatMode === "voice" && (
            <div className="dash_panelControls">
              {isPlayingAudio ? (
                <button
                  className="dash_talkBtn dash_talkBtn--playing"
                  onClick={stopAudio}
                  aria-label="Stop audio"
                >
                  <div className="dash_audioWave">
                    <span /><span /><span /><span /><span />
                  </div>
                  Listening...
                </button>
              ) : (
                <button
                  className="dash_talkBtn"
                  onClick={() => {/* ready for next response */}}
                  aria-label="Voice mode active"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                  Voice Mode
                </button>
              )}
            </div>
          )}
          </div>
        )}
        
        <div className={`dash_right ${chatMode === "chat" ? "dash_right--expanded" : ""}`}>
          
          {/* Welcome state - centered when no messages */}
          {!chatStarted && !activeRunId && !showHitlWizard && (
            <div className="dash_welcomeCenter">
              <div className="dash_welcomeContent">
                <div className="dash_welcomeSunIcon">
                  {getTimeOfDayIcon()}
                </div>
                <div className="dash_welcomeTextBlock">
                  <div className="dash_welcomeLabel">{displayName}'s Workspace</div>
                  <h1 className="dash_welcomeGreeting dash_shineText">{getGreeting()}, {displayName}</h1>
                  <div className="dash_welcomeStats">
                    <div className="dash_statsLine" />
                    <div className="dash_statsList">
                      {stats.map((stat, index) => (
                        <div 
                          key={stat.label} 
                          className="dash_statItem"
                          style={{ animationDelay: `${0.9 + index * 0.55}s` }}
                        >
                          <span className="dash_statValue">{stat.value}</span>
                          <span className="dash_statLabel">{stat.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Small workspace label when chat has messages (hidden in minimal header mode) */}
          {headerMode !== 1 && chatStarted && currentSession && currentSession.messages.length > 0 && (
            <div className="dash_rightHeaderCompact">
              <span className="dash_rightLabel">{displayName}'s Workspace</span>
            </div>
          )}

          {/* Agent Mode indicator (Agent mode only) */}
          {chatMode === "agent" && chatStarted && !showHitlWizard && !isLoading && (
            <div className="dash_agentMode">
              <div className="dash_agentModeIcon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 className="dash_agentModeTitle">Now in Agent Mode</h2>
              <p className="dash_agentModeDesc">
                In this mode, Sentinela will try to physically complete your demands, which means:
              </p>
              <ul className="dash_agentModeList">
                <li>Real-Time Data driven thinking</li>
                <li>Shorter Answers</li>
                <li>Real World Actions</li>
              </ul>
            </div>
          )}


          {/* HITL Wizard - clarification questions */}
          {showHitlWizard && (
            <HITLWizard
              questions={hitlQuestions}
              currentIndex={hitlCurrentIndex}
              answers={hitlAnswers}
              onAnswer={handleHitlAnswer}
              onSkip={handleHitlSkip}
              onComplete={handleHitlComplete}
            />
          )}

          {/* Messages area (Chat, Voice, Code modes) */}
          {chatMode !== "agent" && chatStarted && currentSession && currentSession.messages.length > 0 && !showHitlWizard && (
            <div className="dash_messagesArea" ref={messagesAreaRef}>
              <div className="dash_messagesInner">
                {currentSession.messages.map((msg, msgIdx, msgArr) => {
                  const isLastAi = msg.sender === "ai" && !msgArr.slice(msgIdx + 1).some(m => m.sender === "ai");
                  return (
                  <div key={msg.id}>
                    {isLastAi && (
                      <div className="dash_agentLabel dash_shineText">ORION</div>
                    )}
                    <MessageBubble
                      message={msg}
                      hideCodeBlocks={chatMode === "code"}
                      isLatestAi={isLastAi}
                    />
                    {msg.sender === "user" && eventRuns[msg.id] && (
                      <InlineEventRun
                        run={eventRuns[msg.id]}
                        onToggleExpand={handleToggleEventRun}
                      />
                    )}
                  </div>
                  );
                })}

                {/* Follow-up suggestions after messages */}
                {!isLoading && suggestions.length > 0 && (
                  <FollowUpSuggestions 
                    suggestions={suggestions}
                    onSelect={handleSuggestionClick}
                  />
                )}
                
                <div ref={messagesEndRef} />
              </div>
              
              {/* Scroll to bottom button */}
              {showScrollButton && (
                <button 
                  type="button"
                  className="dash_scrollToBottom"
                  onClick={scrollToBottom}
                  aria-label="Scroll to bottom"
                >
                  <ArrowUp size={16} style={{ transform: 'rotate(180deg)' }} />
                </button>
              )}
            </div>
          )}

          <div className="dash_chatWrapper">
            <ChatInput 
              value={chatMessage}
              onChange={setChatMessage}
              onSubmit={handleSendMessage}
              placeholder="Try something..."
              disabled={isLoading}
              isLoading={isLoading}
              onStop={handleStopThinking}
              pendingFiles={pendingFiles}
              onAttachClick={handleAttachClick}
              onRemoveFile={handleRemoveFile}
            />
            <input 
              ref={fileInputRef} 
              type="file" 
              multiple 
              className="dash_hiddenInput" 
              onChange={handleFilesSelected} 
            />
          </div>
        </div>
      </main>
    </div>
  );
}