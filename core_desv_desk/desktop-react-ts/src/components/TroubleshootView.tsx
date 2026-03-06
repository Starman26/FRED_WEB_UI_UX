// src/components/TroubleshootView.tsx

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Loader2, Wrench, CheckCircle, Send, FileText, Zap, Globe } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAgentChat } from "./useAgentChat";
import type { PracticeChunk, AgentEvent } from "./useAgentChat";
import {
  MessageBubble,
  type Message,
} from "./ChatComponents";
import type { EquipmentProfile } from "./EquipmentTab";
import { equipmentTypeIcon } from "./EquipmentTab";

const AGENT_API_URL = import.meta.env.VITE_AGENT_API_URL || "https://sentinela-909652673285.us-central1.run.app";

// ── Types ──

interface TroubleshootStep {
  label: string;
  status: "pending" | "active" | "done";
}

interface TroubleshootViewProps {
  equipment: EquipmentProfile;
  userId: string;
  teamId: string;
  onBack: () => void;
}

// ═══════════════════════════════════
// Repair Technician Avatar
// ═══════════════════════════════════

type AvatarEyeState = "idle" | "blink" | "wide" | "look" | "sleepy";

function RepairAvatar({ status }: { status: "idle" | "executing" | "resolved" | "escalated" }) {
  const [eyeState, setEyeState] = useState<AvatarEyeState>("idle");
  const [lookDir, setLookDir] = useState({ x: 0, y: 0 });
  const eyeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runEyeLoop = useCallback(() => {
    if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current);

    const actions: AvatarEyeState[] = ["blink", "blink", "wide", "look", "idle", "idle", "idle"];
    const pick = actions[Math.floor(Math.random() * actions.length)];
    const nextDelay = () => 2000 + Math.random() * 2500;

    if (pick === "blink") {
      setEyeState("blink");
      eyeTimerRef.current = setTimeout(() => {
        setEyeState("idle");
        eyeTimerRef.current = setTimeout(runEyeLoop, nextDelay());
      }, 180);
    } else if (pick === "wide") {
      setEyeState("wide");
      eyeTimerRef.current = setTimeout(() => {
        setEyeState("idle");
        eyeTimerRef.current = setTimeout(runEyeLoop, nextDelay());
      }, 1000 + Math.random() * 1500);
    } else if (pick === "look") {
      setLookDir({ x: (Math.random() - 0.5) * 8, y: (Math.random() - 0.5) * 6 });
      setEyeState("look");
      eyeTimerRef.current = setTimeout(() => {
        setEyeState("idle");
        setLookDir({ x: 0, y: 0 });
        eyeTimerRef.current = setTimeout(runEyeLoop, nextDelay());
      }, 1500 + Math.random() * 2500);
    } else {
      setEyeState("idle");
      eyeTimerRef.current = setTimeout(runEyeLoop, nextDelay());
    }
  }, []);

  useEffect(() => {
    if (status === "executing") {
      // Stop eye loop, use CSS pulse instead
      if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current);
      setEyeState("idle");
      setLookDir({ x: 0, y: 0 });
    } else if (status === "resolved") {
      if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current);
      setEyeState("wide");
      eyeTimerRef.current = setTimeout(() => {
        setEyeState("idle");
        eyeTimerRef.current = setTimeout(runEyeLoop, 2000);
      }, 2000);
    } else if (status === "escalated") {
      if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current);
      setEyeState("sleepy");
    } else {
      // idle — run normal loop
      eyeTimerRef.current = setTimeout(runEyeLoop, 800 + Math.random() * 1500);
    }
    return () => { if (eyeTimerRef.current) clearTimeout(eyeTimerRef.current); };
  }, [status, runEyeLoop]);

  const eyeClass = status !== "executing" && eyeState !== "idle" ? `ts__avatarEye--${eyeState}` : "";
  const eyeStyle = eyeState === "look"
    ? { "--look-x": `${lookDir.x}px`, "--look-y": `${lookDir.y}px` } as React.CSSProperties
    : undefined;

  return (
    <div className="ts__avatar">
      <div className="ts__avatarHelmet" />
      <div className="ts__avatarFace">
        <div className={`ts__avatarEyes ${status === "executing" ? "is-thinking" : ""}`}>
          <div className={`ts__avatarEye ${eyeClass}`} style={eyeStyle} />
          <div className={`ts__avatarEye ${eyeClass}`} style={eyeStyle} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════
// Main TroubleshootView
// ═══════════════════════════════════

export default function TroubleshootView({ equipment, userId, teamId, onBack }: TroubleshootViewProps) {
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([]);
  const [problemDesc, setProblemDesc] = useState("");
  const [started, setStarted] = useState(false);
  const [steps, setSteps] = useState<TroubleshootStep[]>([]);
  const [thinking, setThinking] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const msgsEndRef = useRef<HTMLDivElement>(null);
  const insertedMsgIds = useRef<Set<string>>(new Set());

  // ── Insert message helper (dedup) ──
  const insertMessage = useCallback(async (msg: { id: string; session_id: string; sender: string; auth_user_id: string; content: string }) => {
    if (insertedMsgIds.current.has(msg.id)) return;
    insertedMsgIds.current.add(msg.id);
    const { error } = await supabase.schema("chat").from("messages").insert(msg);
    if (error) {
      console.error("[Troubleshoot] insert error:", error);
      insertedMsgIds.current.delete(msg.id);
    }
  }, []);

  // ── Agent chat hook ──
  const { sendMessage, isStreaming } = useAgentChat({
    apiUrl: AGENT_API_URL,
    userId,
    sessionId,
    interactionMode: "troubleshoot",
    onEvent: (evt: AgentEvent) => {
      if (evt.type === "questions" && evt.metadata?.questions) {
        const questions = evt.metadata.questions;
        const questionText = questions.map((q: any) => {
          if (typeof q === "string") return q;
          return q.question || q.text || JSON.stringify(q);
        }).join("\n");

        setThinking(false);
        setStreamBuffer("");
        setMessages((prev) => [...prev, {
          id: crypto.randomUUID(),
          text: questionText,
          sender: "ai" as const,
          createdAt: new Date().toISOString(),
        }]);
      }
    },
    onPracticeChunk: (chunk: PracticeChunk) => {
      if (chunk.type === "partial" && chunk.content) {
        setStreamBuffer((prev) => prev + chunk.content);
      }
      if (chunk.type === "tool_status" && chunk.tool) {
        setSteps((prev) => {
          const updated = [...prev];
          const activeIdx = updated.findIndex((s) => s.status === "active");
          if (activeIdx >= 0) {
            updated[activeIdx].status = "done";
            if (activeIdx + 1 < updated.length) {
              updated[activeIdx + 1].status = "active";
            }
          }
          return updated;
        });
      }
    },
    onResponse: (content: string) => {
      setThinking(false);
      setStreamBuffer("");
      const msgId = crypto.randomUUID();
      const aiMsg: Message = { id: msgId, sender: "ai", text: content, createdAt: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
      insertMessage({ id: msgId, session_id: sessionId, sender: "ai", auth_user_id: userId, content });

      if (steps.length === 0) {
        const parsed = parseDiagnosticSteps(content);
        if (parsed.length > 0) setSteps(parsed);
      }
    },
    onError: (err: string) => {
      setThinking(false);
      setStreamBuffer("");
      console.error("[Troubleshoot] agent error:", err);
    },
    onStreamEnd: () => {
      setThinking(false);
      setStreamBuffer("");
    },
  });

  // ── Auto-scroll ──
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamBuffer]);

  // ── Start troubleshooting ──
  const handleStart = async () => {
    if (!problemDesc.trim()) return;
    setStarted(true);
    setThinking(true);

    // Create chat session in Supabase BEFORE any messages
    await supabase.schema("chat").from("sessions").insert({
      id: sessionId,
      auth_user_id: userId,
      team_id: teamId,
      title: `Troubleshoot: ${equipment.name}`,
      chat_mode: "troubleshoot",
      status: "active",
      focused_on: "troubleshooting",
    });

    // Create troubleshoot session record
    await supabase.schema("lab").from("troubleshoot_sessions").insert({
      id: crypto.randomUUID(),
      chat_session_id: sessionId,
      equipment_profile_id: equipment.id,
      problem_description: problemDesc.trim(),
      status: "planning",
      team_id: teamId,
    });

    const userMsgId = crypto.randomUUID();
    const userMsg: Message = { id: userMsgId, sender: "user", text: problemDesc, createdAt: new Date().toISOString() };
    setMessages([userMsg]);
    insertMessage({ id: userMsgId, session_id: sessionId, sender: "user", auth_user_id: userId, content: problemDesc.trim() });

    const context = [
      `Equipment: ${equipment.name}`,
      equipment.brand ? `Brand: ${equipment.brand}` : null,
      equipment.model ? `Model: ${equipment.model}` : null,
      equipment.ip_address ? `IP: ${equipment.ip_address}` : null,
      equipment.description ? `Description: ${equipment.description}` : null,
      equipment.manuals.length > 0 ? `Manuals: ${equipment.manuals.map((m) => `${m.title} (${m.pages_total} pages)`).join(", ")}` : null,
    ].filter(Boolean).join("\n");

    const fullMessage = `[Equipment Context]\n${context}\n\n[Problem]\n${problemDesc}`;

    sendMessage(fullMessage);
  };

  // ── Follow-up message ──
  const [followUp, setFollowUp] = useState("");
  const handleFollowUp = () => {
    if (!followUp.trim() || isStreaming) return;
    setThinking(true);

    const msgId = crypto.randomUUID();
    const userMsg: Message = { id: msgId, sender: "user", text: followUp, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    insertMessage({ id: msgId, session_id: sessionId, sender: "user", auth_user_id: userId, content: followUp });

    sendMessage(followUp);
    setFollowUp("");
  };

  // ── Sidebar (shared between both views) ──
  const sidebar = (
    <div className="studio__troubleshootSidebar">
      <div className="studio__practiceSidebarNav">
        <button type="button" className="studio__practiceBack" onClick={onBack}>
          <ArrowLeft size={14} /> Back to Equipment
        </button>
        <span className="studio__practiceSidebarLabel">Troubleshoot</span>
      </div>

      {/* Equipment info */}
      <div className="studio__troubleshootEquipInfo">
        <div className="studio__troubleshootEquipIcon">
          {equipmentTypeIcon(equipment.type, 24)}
        </div>
        <div className="studio__troubleshootEquipMeta">
          <span className="studio__troubleshootEquipName">{equipment.name}</span>
          <span className="studio__troubleshootEquipType">
            {[equipment.brand, equipment.model].filter(Boolean).join(" ") || equipment.type}
          </span>
        </div>
      </div>

      {/* Diagnostic steps (active session only) */}
      {started && steps.length > 0 && (
        <div className="studio__troubleshootSteps">
          <div className="studio__troubleshootStepsTitle">Diagnostic Plan</div>
          {steps.map((step, i) => (
            <div
              key={i}
              className={`studio__troubleshootStep studio__troubleshootStep--${step.status}`}
            >
              <div className="studio__troubleshootStepDot">
                {step.status === "done" ? (
                  <CheckCircle size={16} />
                ) : (
                  <span className="studio__troubleshootStepNum">{i + 1}</span>
                )}
              </div>
              <span className="studio__troubleshootStepLabel">{step.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Manuals section */}
      {equipment.manuals.length > 0 && (
        <div className="ts__sidebarSection">
          <div className="ts__sidebarSectionTitle">Manuals</div>
          {equipment.manuals.map((m) => (
            <div key={m.id} className="ts__sidebarItem">
              <FileText size={13} />
              <span>{m.title} ({m.pages_total}p)</span>
            </div>
          ))}
        </div>
      )}

      {/* Tools section */}
      <div className="ts__sidebarSection">
        <div className="ts__sidebarSectionTitle">Tools</div>
        <div className="ts__sidebarItem"><Zap size={13} /> RAG Manual Search</div>
        <div className="ts__sidebarItem"><Globe size={13} /> Web Search</div>
        <div className="ts__sidebarItem"><Wrench size={13} /> Ping Device</div>
      </div>

      {/* Web search toggle */}
      <div className="ts__sidebarToggle">
        <span className="ts__sidebarToggleLabel">Web Search</span>
        <button
          type="button"
          className={`ts__toggleSwitch ${webSearchEnabled ? "is-active" : ""}`}
          onClick={() => setWebSearchEnabled(!webSearchEnabled)}
          aria-label="Toggle web search"
        />
      </div>
    </div>
  );

  // ── Not started: problem description form ──
  if (!started) {
    return (
      <div className="studio__troubleshootView">
        {sidebar}
        <div className="studio__troubleshootMain">
          <div className="studio__troubleshootStartCard">
            <RepairAvatar status="idle" />
            <h2 className="studio__troubleshootStartTitle">
              Describe the problem with {equipment.name}
            </h2>
            <p className="studio__troubleshootStartDesc">
              The AI agent will diagnose the issue step by step
              {equipment.manuals.length > 0 ? `, using manuals: ${equipment.manuals.map((m) => m.title).join(", ")}.` : "."}
            </p>
            <textarea
              className="studio__troubleshootTextarea"
              placeholder="e.g. The robot arm is not responding to movement commands after power cycle..."
              value={problemDesc}
              onChange={(e) => setProblemDesc(e.target.value)}
              rows={4}
              autoFocus
            />
            <button
              type="button"
              className="studio__troubleshootStartBtn"
              disabled={!problemDesc.trim()}
              onClick={handleStart}
            >
              <Wrench size={14} />
              Start Troubleshooting
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active troubleshooting session ──
  return (
    <div className="studio__troubleshootView">
      {sidebar}

      {/* Chat area */}
      <div className="studio__troubleshootChat">
        <div className="studio__troubleshootMsgs">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Streaming buffer */}
          {streamBuffer && (
            <MessageBubble
              message={{ id: "stream", sender: "ai", text: streamBuffer, createdAt: new Date().toISOString() }}
            />
          )}

          {/* Thinking indicator */}
          {thinking && !streamBuffer && (
            <div className="studio__troubleshootThinking">
              <Loader2 size={16} className="studio__practiceLoadingSpinner" />
              <span>Diagnosing...</span>
            </div>
          )}

          <div ref={msgsEndRef} />
        </div>

        {/* Follow-up input */}
        <div className="studio__troubleshootInputArea">
          <div className="studio__troubleshootInputBox">
            <textarea
              className="studio__troubleshootInput"
              placeholder="Add more details or ask a follow-up question..."
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleFollowUp();
                }
              }}
              rows={1}
              disabled={isStreaming}
            />
            <button
              type="button"
              className="studio__troubleshootSendBtn"
              onClick={handleFollowUp}
              disabled={!followUp.trim() || isStreaming}
            >
              <Send size={14} />
            </button>
          </div>
          <p className="studio__practiceDisclaimer">
            AI diagnostics are for guidance only — always verify with official documentation.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Parse diagnostic steps from AI response ──
function parseDiagnosticSteps(content: string): TroubleshootStep[] {
  const steps: TroubleshootStep[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*\d+[\.\)]\s+(.+)/);
    if (match && match[1].length > 5 && match[1].length < 120) {
      steps.push({ label: match[1].trim(), status: "pending" });
    }
  }

  if (steps.length > 0) {
    steps[0].status = "active";
  }

  return steps.length >= 2 ? steps : [];
}
