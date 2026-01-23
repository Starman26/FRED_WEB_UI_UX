// src/pages/Chat.tsx
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import ChatThinkingIndicator from "../components/ChatThinkingIndicator";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import ReactMarkdown from "react-markdown";
import {
  Users,
  User as UserIcon,
  Edit2,
  Trash2,
  Paperclip,
  ArrowUp,
  ThumbsUp,
  ThumbsDown,
  Search,
  Copy,
  Check,
  ChevronDown,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";

/* Variant CSS (solo afecta cuando variant="dashboard") */
import "../styles/chat-variant.css";

/* =========================================================
   Types
   ========================================================= */

type Attachment = {
  id: string;
  name: string;
  url: string;
  type: "image" | "file";
};

type ManualImage = {
  id: string;
  page: number | null;
  path: string;
  url: string;
};

type PastedBlock = {
  id: string;
  title: string;
  text: string;
  wordCount: number;
  createdAt: string;
};

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
  createdAt?: string;
  imageUrl?: string;
  attachments?: Attachment[];
  pastedBlocks?: PastedBlock[]; // solo UI local (no viene de BD)
};

type Session = {
  id: string;
  title: string;
  createdAt: string;
  messages: Message[];
  chatMode?: "group" | "individual";
};

type Task = {
  id: string;
  title: string;
  description: string;
  project_id?: string;
  progress: number;
  dueDate: string;
  sessionId?: string;
  chatMode?: "group" | "individual";
};

type SessionFilter = "all" | "today" | "7d" | "30d";
type ChatVariant = "page" | "dashboard";

type ActiveAgentUI = {
  name: string;
  subtitle?: string;
  iconUrl?: string;
};

/* =========================================================
   Env
   ========================================================= */

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.warn("[Chat] VITE_API_URL no está definido. Configúralo en tu archivo .env");
}

/* =========================================================
   Small hooks / helpers
   ========================================================= */

// Placeholder rotatorio
function useRotatingPlaceholder(messages: string[], delay = 3000) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages.length) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), delay);
    return () => clearInterval(id);
  }, [messages, delay]);

  return messages[index] ?? "";
}

const safeDate = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const countWords = (t: string) =>
  t
    .trim()
    .split(/\s+/g)
    .filter(Boolean).length;

const firstNonEmptyLine = (t: string) => {
  const lines = t.split(/\r?\n/).map((l) => l.trim());
  return lines.find((l) => l.length > 0) ?? "";
};

const makePasteTitle = (t: string) => {
  const line = firstNonEmptyLine(t);
  const trimmed = line.length > 46 ? line.slice(0, 46) + "…" : line;
  return trimmed || "Contenido pegado";
};

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* =========================================================
   CodeBlock component
   ========================================================= */

const CodeBlock = ({ language, value }: { language: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const highlightCode = (code: string) => {
    const keywords = [
      "import",
      "from",
      "def",
      "class",
      "return",
      "if",
      "else",
      "elif",
      "for",
      "while",
      "in",
      "as",
      "try",
      "except",
      "with",
      "await",
      "async",
      "const",
      "let",
      "var",
      "function",
    ];
    const builtins = ["print", "range", "len", "str", "int", "float"];
    const strings = /('.*?'|".*?")/g;
    const comments = /(#.*$|\/\/.*$)/gm;

    let highlighted = code
      .replace(strings, '<span class="code-string">$1</span>')
      .replace(comments, '<span class="code-comment">$1</span>');

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, "g");
      highlighted = highlighted.replace(regex, `<span class="code-keyword">${keyword}</span>`);
    });

    builtins.forEach((builtin) => {
      const regex = new RegExp(`\\b${builtin}\\b`, "g");
      highlighted = highlighted.replace(regex, `<span class="code-builtin">${builtin}</span>`);
    });

    return highlighted;
  };

  return (
    <div className="code-block my-4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
      <div className="code-block-header flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="code-block-language text-[11px] font-semibold tracking-[0.12em] text-slate-200 uppercase">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className={`code-block-copy-btn flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] ${
            copied ? "copied" : ""
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copiar
            </>
          )}
        </button>
      </div>

      <div className="code-block-content">
        <pre className="m-0 overflow-x-auto">
          <code
            className="block text-[13px] leading-relaxed font-mono text-slate-50 whitespace-pre"
            dangerouslySetInnerHTML={{ __html: highlightCode(value) }}
          />
        </pre>
      </div>
    </div>
  );
};

/* =========================================================
   Main component
   ========================================================= */

export default function Chat({
  layout = "page",
  planes = "both",
  variant,
  activeAgent,
  onFirstUserMessage,
}: {
  layout?: "page" | "planes";
  planes?: "both" | "downOnly" | "upOnly";
  variant?: ChatVariant;
  activeAgent?: ActiveAgentUI | null;
  onFirstUserMessage?: () => void;
}) {
  /* ---------------------------
     Layout / variant resolution
     --------------------------- */
  const isPlanes = layout === "planes";
  const resolvedVariant: ChatVariant = variant ?? (isPlanes ? "dashboard" : "page");
  const isDashboard = resolvedVariant === "dashboard";

  /* ---------------------------
     Auth
     --------------------------- */
  const { userId, userEmail } = useAuth();
  const safeEmail: string | null = userEmail || null;

  /* ---------------------------
     Refs
     --------------------------- */
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerBoxRef = useRef<HTMLDivElement | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const involvedBtnRef = useRef<HTMLButtonElement | null>(null);
  const firedFirstUserMsgSessionsRef = useRef<Set<string>>(new Set());

  /* ---------------------------
     State: data
     --------------------------- */
  const [manualImages, setManualImages] = useState<ManualImage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const [sessionFilter, setSessionFilter] = useState<SessionFilter>("all");

  /* ---------------------------
     State: UI
     --------------------------- */
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [lastDebugInfo, setLastDebugInfo] = useState<any | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [avatarId, setAvatarId] = useState<string>("cat");

  const [sidebarMode, setSidebarMode] = useState<"shortcuts" | "tasks" | "files">("tasks");

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const [pastedBlocks, setPastedBlocks] = useState<PastedBlock[]>([]);
  const [pasteModal, setPasteModal] = useState<PastedBlock | null>(null);

  const [inspectMsg, setInspectMsg] = useState<Message | null>(null);
  const [inspectQuery, setInspectQuery] = useState<string>("");

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");

  /* ---------------------------
     LLM picker (mock UI)
     --------------------------- */
  const llmOptions = useMemo(() => ["GPT-5", "Claude Sonnet 4.5", "Gemini", "Local (mock)"], []);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [modelsPos, setModelsPos] = useState<{ top: number; left: number } | null>(null);
  const [selectedLlms, setSelectedLlms] = useState<string[]>(["GPT-5"]);

  /* ---------------------------
     Placeholder
     --------------------------- */
  const placeholders = [
    "Analizar datos de sensores...",
    "Revisar estado del PLC...",
    "Consultar protocolos de laboratorio...",
    "Generar reporte de calidad...",
    "Configurar parámetros de medición...",
  ];
  const placeholder = useRotatingPlaceholder(placeholders, 3500);

  /* =========================================================
     Derived session/task info
     ========================================================= */

  const currentSession: Session =
    (selectedSessionId && sessions.find((s) => s.id === selectedSessionId)) || {
      id: selectedSessionId || "temp",
      title: "Nueva sesión",
      createdAt: new Date().toISOString(),
      messages: [],
    };

  const activeTask: Task | undefined = tasks.find(
    (t) => t.sessionId === currentSession.id || t.title === currentSession.title
  );

  const currentChatMode: "group" | "individual" =
    activeTask?.chatMode ?? currentSession.chatMode ?? "individual";

  /* =========================================================
     Utilities
     ========================================================= */

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const resolveManualImageUrl = (rawPath: string): string => {
    if (!rawPath) return "";

    if (rawPath.startsWith("http://") || rawPath.startsWith("https://")) {
      return rawPath;
    }

    const [bucket, ...rest] = rawPath.split("/");
    if (!bucket || rest.length === 0) return rawPath;

    const objectPath = rest.join("/");
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    return data?.publicUrl ?? rawPath;
  };

  /* =========================================================
     Planes mode: find target DOM nodes
     ========================================================= */

  const [upPlaneEl, setUpPlaneEl] = useState<HTMLElement | null>(null);
  const [downPlaneEl, setDownPlaneEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!isPlanes) return;

    let raf = 0;

    const findPlanes = () => {
      const up = document.getElementById("right_up_plane");
      const down = document.getElementById("right_down_plane");

      const needsUp = planes === "both" || planes === "upOnly";
      const needsDown = planes === "both" || planes === "downOnly";

      const okUp = !needsUp || !!up;
      const okDown = !needsDown || !!down;

      if (okUp && okDown) {
        setUpPlaneEl(needsUp ? (up as HTMLElement) : null);
        setDownPlaneEl(needsDown ? (down as HTMLElement) : null);
        return;
      }

      raf = requestAnimationFrame(findPlanes);
    };

    findPlanes();
    return () => cancelAnimationFrame(raf);
  }, [isPlanes, planes]);

  /* =========================================================
     Load manual_images
     ========================================================= */

  useEffect(() => {
    const loadManualImages = async () => {
      try {
        const { data, error } = await supabase.from("manual_images").select("id, page, path");

        if (error) {
          console.error("[Chat] Error cargando manual_images:", error);
          return;
        }

        const mapped: ManualImage[] = (data ?? []).map((row: any) => ({
          id: row.id,
          page: row.page ?? null,
          path: row.path,
          url: resolveManualImageUrl(row.path),
        }));

        setManualImages(mapped);
      } catch (err) {
        console.error("[Chat] Excepción cargando manual_images:", err);
      }
    };

    loadManualImages();
  }, []);

  /* =========================================================
     Scroll on new messages
     ========================================================= */

  useEffect(() => {
    if (currentSession.messages.length > 0) {
      scrollToBottom();
    }
  }, [currentSession.messages.length]);

  /* =========================================================
     Copy helper
     ========================================================= */

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => {
        setCopiedId((prev) => (prev === id ? null : prev));
      }, 1500);
    } catch (e) {
      console.error("No se pudo copiar al portapapeles:", e);
    }
  };

  /* =========================================================
     Sessions: local fallback
     ========================================================= */

  const createLocalSession = () => {
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newSession: Session = {
      id: newId,
      title: "Nueva sesión",
      createdAt: now,
      messages: [],
    };
    setSessions([newSession]);
    setSelectedSessionId(newId);
    sessionIdRef.current = newId;
  };

  /* =========================================================
     Load messages for a session
     ========================================================= */

  const loadMessagesForSession = useCallback(async (sessionId: string) => {
    setMessagesLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_message")
        .select("id, role, content, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("[Chat] Error cargando mensajes:", error);
        return;
      }

      const msgs: Message[] =
        data?.map((row: any) => ({
          id: row.id,
          text: row.content,
          sender: row.role === "student" || row.role === "user" ? "user" : "ai",
          createdAt: row.created_at,
        })) ?? [];

      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, messages: msgs } : s)));
    } catch (err) {
      console.error("[Chat] Excepción cargando mensajes:", err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  /* =========================================================
     Load sessions
     ========================================================= */

  useEffect(() => {
    const loadSessionsFromSupabase = async () => {
      setSessionsLoading(true);
      try {
        let query = supabase.from("chat_session").select("id, title, started_at");

        if (sessionFilter !== "all") {
          const now = new Date();
          let from = new Date();

          if (sessionFilter === "today") {
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          } else if (sessionFilter === "7d") {
            from.setDate(now.getDate() - 7);
          } else if (sessionFilter === "30d") {
            from.setDate(now.getDate() - 30);
          }

          query = query.gte("started_at", from.toISOString());
        }

        query = query.order("started_at", { ascending: false });

        const { data, error } = await query;

        if (error) {
          console.error("[Chat] Error cargando sesiones:", error);
          if (sessionFilter === "all") createLocalSession();
          return;
        }

        if (!data || data.length === 0) {
          if (sessionFilter === "all") createLocalSession();
          else setSessions([]);
          return;
        }

        const loadedSessions: Session[] = data.map((row: any) => ({
          id: row.id,
          title: row.title || "Sesión sin título",
          createdAt: row.started_at || new Date().toISOString(),
          messages: [],
        }));

        setSessions(loadedSessions);
        setSelectedSessionId(loadedSessions[0].id);
        sessionIdRef.current = loadedSessions[0].id;

        await loadMessagesForSession(loadedSessions[0].id);
      } catch (err) {
        console.error("[Chat] Excepción cargando sesiones:", err);
        if (sessionFilter === "all") createLocalSession();
      } finally {
        setSessionsLoading(false);
      }
    };

    loadSessionsFromSupabase();
  }, [sessionFilter, loadMessagesForSession]);

  /* =========================================================
     Load avatar preference
     ========================================================= */

  useEffect(() => {
    const loadAvatar = async () => {
      if (!userId) return;

      const { data, error } = await supabase
        .from("students")
        .select("widget_avatar_id")
        .eq("auth_user_id", userId)
        .single();

      if (!error && data?.widget_avatar_id) {
        setAvatarId(data.widget_avatar_id);
      }
    };

    loadAvatar();
  }, [userId]);

  /* =========================================================
     Projects/tasks with progress
     ========================================================= */

  const loadPendingProjects = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      return;
    }

    try {
      const { data: memberRows } = await supabase
        .from("project_members")
        .select("project_id")
        .eq("user_id", userId);

      const memberProjectIds = memberRows?.map((r: any) => r.project_id) ?? [];
      const today = new Date().toISOString().split("T")[0];

      const base = supabase
        .from("projects")
        .select("id, name, description, status, due_date, chat_mode")
        .eq("status", "active")
        .gte("due_date", today);

      const { data: ownedRaw } = await base.eq("user_id", userId);

      const { data: assignedRaw } =
        memberProjectIds.length > 0
          ? await supabase
              .from("projects")
              .select("id, name, description, status, due_date, chat_mode")
              .eq("status", "active")
              .gte("due_date", today)
              .in("id", memberProjectIds)
          : { data: [] as any[] };

      const owned = ownedRaw ?? [];
      const assigned = assignedRaw ?? [];

      const projects = Array.from(new Map([...owned, ...assigned].map((p: any) => [p.id, p])).values());

      const tasksWithProgress: Task[] = [];

      for (const p of projects as any[]) {
        const { data: stepsRaw } = await supabase
          .from("task_steps")
          .select("id, completed")
          .eq("project_id", p.id);

        const steps = stepsRaw ?? [];
        const total = steps.length;
        const completed = steps.filter((s: any) => s.completed).length;
        const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

        tasksWithProgress.push({
          id: p.id,
          title: p.name,
          description: p.description ?? "Sin descripción",
          progress,
          dueDate: p.due_date,
          chatMode: p.chat_mode ?? "individual",
          sessionId: tasks.find((t) => t.id === p.id)?.sessionId ?? undefined,
        });
      }

      setTasks(tasksWithProgress);
    } catch (err) {
      console.error("[Chat] Error cargando proyectos con progreso:", err);
    }
  }, [userId, tasks]);

  useEffect(() => {
    loadPendingProjects();
  }, [loadPendingProjects]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("task_steps_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "task_steps" }, () => {
        loadPendingProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadPendingProjects]);

  /* =========================================================
     New session
     ========================================================= */

  const handleNewSession = async () => {
    if (!userId && !safeEmail) {
      createLocalSession();
      return;
    }

    try {
      const { data, error } = await supabase
        .from("chat_session")
        .insert({
          user_id: userId ?? null,
          user_email: safeEmail ?? null,
          title: "Nuevo análisis",
        })
        .select("id, started_at, title")
        .single();

      if (error || !data) {
        console.error("[Chat] Error creando nueva sesión:", error);
        createLocalSession();
        return;
      }

      const newSession: Session = {
        id: data.id,
        title: data.title || "Nuevo análisis",
        createdAt: data.started_at || new Date().toISOString(),
        messages: [],
      };

      setSessions((prev) => [newSession, ...prev]);
      setSelectedSessionId(newSession.id);
      sessionIdRef.current = newSession.id;
      setLastDebugInfo(null);
    } catch (e) {
      console.error("[Chat] Excepción creando nueva sesión:", e);
      createLocalSession();
    }
  };

  /* =========================================================
     Open task -> session
     ========================================================= */

  const handleOpenTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    let sessionId = task.sessionId;

    if (sessionId && sessions.find((s) => s.id === sessionId)) {
      setSelectedSessionId(sessionId);
      sessionIdRef.current = sessionId;
      await loadMessagesForSession(sessionId);
      return;
    }

    const existingSession = sessions.find((s) => s.title === task.title);

    if (existingSession) {
      sessionId = existingSession.id;

      if (userId || safeEmail) {
        try {
          await supabase
            .from("chat_session")
            .update({
              metadata: {
                chat_type: "practice",
                project_id: task.id,
                current_task_id: null,
              },
            })
            .eq("id", sessionId);
        } catch (err) {
          console.error("[Chat] Error actualizando metadata chat_session:", err);
        }
      }
    } else {
      if (userId || safeEmail) {
        try {
          const { data, error } = await supabase
            .from("chat_session")
            .insert({
              user_id: userId ?? null,
              user_email: safeEmail ?? null,
              title: task.title,
              metadata: {
                chat_type: "practice",
                project_id: task.id,
                current_task_id: null,
              },
            })
            .select("id, started_at, title")
            .single();

          if (error || !data) {
            console.error("[Chat] Error creando sesión para tarea:", error);
            const newId = crypto.randomUUID();
            const now = new Date().toISOString();
            const localSession: Session = { id: newId, title: task.title, createdAt: now, messages: [] };
            setSessions((prev) => [localSession, ...prev]);
            sessionId = newId;
          } else {
            const newSession: Session = {
              id: data.id,
              title: data.title || task.title,
              createdAt: data.started_at || new Date().toISOString(),
              messages: [],
            };
            setSessions((prev) => [newSession, ...prev]);
            sessionId = newSession.id;
          }
        } catch (e) {
          console.error("[Chat] Excepción creando sesión para tarea:", e);
          const newId = crypto.randomUUID();
          const now = new Date().toISOString();
          const localSession: Session = { id: newId, title: task.title, createdAt: now, messages: [] };
          setSessions((prev) => [localSession, ...prev]);
          sessionId = newId;
        }
      } else {
        const newId = crypto.randomUUID();
        const now = new Date().toISOString();
        const localSession: Session = { id: newId, title: task.title, createdAt: now, messages: [] };
        setSessions((prev) => [localSession, ...prev]);
        sessionId = newId;
      }
    }

    if (!sessionId) return;

    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, sessionId } : t)));

    setSelectedSessionId(sessionId);
    sessionIdRef.current = sessionId;
    await loadMessagesForSession(sessionId);
  };

  /* =========================================================
     Select session
     ========================================================= */

  const handleSelectSession = async (id: string) => {
    setSelectedSessionId(id);
    sessionIdRef.current = id;
    setLastDebugInfo(null);
    await loadMessagesForSession(id);
  };

  /* =========================================================
     Rename session (inline)
     ========================================================= */

  const startRenameSession = (session: Session) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const commitRenameSession = async () => {
    if (!editingSessionId) return;

    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingSessionId(null);
      setEditingTitle("");
      return;
    }

    setSessions((prev) => prev.map((s) => (s.id === editingSessionId ? { ...s, title: trimmed } : s)));

    try {
      const { error } = await supabase.from("chat_session").update({ title: trimmed }).eq("id", editingSessionId);

      if (error) {
        console.error("[Chat] Error renombrando sesión en Supabase:", error);
        alert(
          "No se pudo guardar el nuevo nombre en la base de datos.\n" +
            (error.message || "Revisa las policies de RLS/permiso de UPDATE en chat_session.")
        );
      }
    } catch (e: any) {
      console.error("[Chat] Excepción renombrando sesión en Supabase:", e);
      alert("Ocurrió un error al renombrar en Supabase.\n" + (e?.message || "Revisa la consola del navegador."));
    } finally {
      setEditingSessionId(null);
      setEditingTitle("");
    }
  };

  const cancelRenameSession = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  /* =========================================================
     Delete session
     ========================================================= */

  const handleDeleteSession = async (sessionId: string) => {
    const confirmDelete = window.confirm("¿Seguro que quieres eliminar esta sesión y sus mensajes?");
    if (!confirmDelete) return;

    try {
      await supabase.from("chat_message").delete().eq("session_id", sessionId);
      await supabase.from("chat_session").delete().eq("id", sessionId);
    } catch (e) {
      console.error("[Chat] Error eliminando sesión en Supabase:", e);
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));

    setTasks((prev) => prev.map((t) => (t.sessionId === sessionId ? { ...t, sessionId: undefined } : t)));

    if (selectedSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length > 0) {
        const first = remaining[0];
        setSelectedSessionId(first.id);
        sessionIdRef.current = first.id;
        loadMessagesForSession(first.id);
      } else {
        setSelectedSessionId(null);
        sessionIdRef.current = null;
      }
    }
  };

  /* =========================================================
     File attachments
     ========================================================= */

  const uploadFilesAndGetUrls = async (files: File[], sessionId: string): Promise<Attachment[]> => {
    if (!files.length) return [];
    const attachments: Attachment[] = [];

    for (const file of files) {
      try {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId ?? "anon"}/${sessionId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const { data, error } = await supabase.storage.from("chat_files").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (error || !data) {
          console.error("[Chat] Error subiendo archivo:", error);
          continue;
        }

        const { data: publicData } = supabase.storage.from("chat_files").getPublicUrl(data.path);
        const publicUrl = publicData?.publicUrl;
        if (!publicUrl) continue;

        attachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: publicUrl,
          type: file.type.startsWith("image/") ? "image" : "file",
        });
      } catch (err) {
        console.error("[Chat] Excepción subiendo archivo:", err);
      }
    }

    return attachments;
  };

  const handleAttachClick = () => {
    if (loading) return;
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setPendingFiles((prev) => [...prev, ...filesArray]);
    e.target.value = "";
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  /* =========================================================
     Paste handling (large pastes -> chips + modal)
     ========================================================= */

  const handleComposerPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const wc = countWords(text);
    if (wc <= 100) return;

    e.preventDefault();

    const block: PastedBlock = {
      id: crypto.randomUUID(),
      title: makePasteTitle(text),
      text,
      wordCount: wc,
      createdAt: new Date().toISOString(),
    };

    setPastedBlocks((prev) => [...prev, block]);
  };

  const removePastedBlock = (id: string) => {
    setPastedBlocks((prev) => prev.filter((b) => b.id !== id));
    if (pasteModal?.id === id) setPasteModal(null);
  };

  /* =========================================================
     Auto-resize composer textarea
     ========================================================= */

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    const MAX = 220;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, MAX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea, pastedBlocks.length]);

  useEffect(() => {
    const box = composerBoxRef.current;
    if (!box) return;

    const ro = new ResizeObserver(() => resizeTextarea());
    ro.observe(box);

    return () => ro.disconnect();
  }, [resizeTextarea]);

  /* =========================================================
     Involved LLMs popover positioning
     ========================================================= */

  const openModelsPopup = () => {
    const el = involvedBtnRef.current;

    if (!el) {
      setModelsPos({ top: 120, left: 24 });
      setModelsOpen(true);
      return;
    }

    const rect = el.getBoundingClientRect();

    const CARD_W = 300;
    const CARD_H = 260;
    const PAD = 12;

    let top = rect.top - CARD_H - 10;
    if (top < PAD) top = rect.bottom + 10;

    top = Math.max(PAD, Math.min(top, window.innerHeight - CARD_H - PAD));

    let left = rect.left;
    left = Math.max(PAD, Math.min(left, window.innerWidth - CARD_W - PAD));

    setModelsPos({ top, left });
    setModelsOpen(true);
  };

  useEffect(() => {
    if (!modelsOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModelsOpen(false);
    };

    const onResizeOrScroll = () => setModelsOpen(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
  }, [modelsOpen]);

  /* =========================================================
     Send message
     ========================================================= */

  const sendMessage = async () => {
    const hasText = !!input.trim();
    const hasFiles = pendingFiles.length > 0;
    const hasPastes = pastedBlocks.length > 0;

    if ((!hasText && !hasFiles && !hasPastes) || loading) return;

    if (!userId) {
      const warning: Message = {
        id: crypto.randomUUID(),
        text: "No pude identificar tu usuario. Inicia sesión nuevamente para continuar la conversación.",
        sender: "ai",
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSession.id ? { ...s, messages: [...s.messages, warning] } : s))
      );
      return;
    }

    if (!API_URL) {
      const warning: Message = {
        id: crypto.randomUUID(),
        text: "VITE_API_URL no está configurado. Revisa tu archivo .env y reinicia la app.",
        sender: "ai",
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSession.id ? { ...s, messages: [...s.messages, warning] } : s))
      );
      return;
    }

    const userText = input.trim();
    const activeSessionId = sessionIdRef.current || currentSession.id || crypto.randomUUID();
    sessionIdRef.current = activeSessionId;

    setLoading(true);

    const pasteFiles: File[] = pastedBlocks.map((b, idx) => {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeIdx = String(idx + 1).padStart(2, "0");
      return new File([b.text], `pasted-${safeIdx}-${stamp}.txt`, { type: "text/plain" });
    });

    let userAttachments: Attachment[] = [];
    try {
      const allFiles = [...pendingFiles, ...pasteFiles];
      if (allFiles.length) {
        userAttachments = await uploadFilesAndGetUrls(allFiles, activeSessionId);
      }
    } catch (err) {
      console.error("[Chat] Error subiendo adjuntos:", err);
    }

    setPendingFiles([]);
    setPastedBlocks([]);

    const userMessageText = userText || (userAttachments.length ? "(Adjuntos enviados)" : "(Mensaje)");

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: userMessageText,
      sender: "user",
      createdAt: new Date().toISOString(),
      attachments: userAttachments.length ? userAttachments : undefined,
      pastedBlocks: pastedBlocks.length ? pastedBlocks : undefined,
    };

    const sessionBefore = sessions.find((s) => s.id === activeSessionId);
    const defaultTitles = ["Nuevo análisis", "Sesión sin título", "Nueva sesión"];
    let newTitleFromPrompt: string | null = null;

    if (sessionBefore) {
      const hadNoMessages = (sessionBefore.messages?.length ?? 0) === 0;
      const hasDefaultTitle = defaultTitles.includes(sessionBefore.title);

      if (hadNoMessages && hasDefaultTitle && userText) {
        newTitleFromPrompt = userText.slice(0, 40) + (userText.length > 40 ? "…" : "");
      }
    }

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [...s.messages, userMessage],
              title: newTitleFromPrompt ?? s.title,
            }
          : s
      )
    );

    setInput("");

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const sessionBeforeSend = sessions.find((s) => s.id === activeSessionId);
    const hadNoMessagesBefore = (sessionBeforeSend?.messages?.length ?? 0) === 0;

    if (onFirstUserMessage && hadNoMessagesBefore && !firedFirstUserMsgSessionsRef.current.has(activeSessionId)) {
      firedFirstUserMsgSessionsRef.current.add(activeSessionId);
      onFirstUserMessage();
    }

    try {
      if (newTitleFromPrompt) {
        await supabase.from("chat_session").update({ title: newTitleFromPrompt }).eq("id", activeSessionId);
      }

      const isPractice = !!activeTask;
      const chatType = isPractice ? "practice" : "default";
      const projectId = activeTask?.id ?? "";

      const attachmentsParam = encodeURIComponent(JSON.stringify(userAttachments));

      let promptText =
        userText || "Estoy enviando adjuntos (archivos/imágenes/texto pegado). Úsalos como contexto para ayudarme.";

      if (pastedBlocks.length) {
        promptText += `\n\nIncluí ${pastedBlocks.length} bloque(s) pegado(s) como archivos .txt adjuntos.`;
      }

      if (selectedLlms.length) {
        promptText += `\n\n[Involved LLMs (mock)]: ${selectedLlms.join(", ")}`;
      }

      const url =
        `${API_URL}?mensaje=${encodeURIComponent(promptText)}` +
        `&session_id=${encodeURIComponent(activeSessionId)}` +
        `&user_id=${encodeURIComponent(userId)}` +
        `&user_email=${encodeURIComponent(safeEmail ?? "")}` +
        `&avatar_id=${encodeURIComponent(avatarId)}` +
        `&chat_type=${encodeURIComponent(chatType)}` +
        `&project_id=${encodeURIComponent(projectId)}` +
        `&attachments=${attachmentsParam}`;

      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        console.error("[Chat] Respuesta HTTP no OK:", res.status, res.statusText);
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const data: any = await res.json();

      const aiText: string = data.response ?? "El agente no devolvió una respuesta.";

      const imageId: string | undefined = data.image_id;
      const selectedImageUrl =
        imageId && manualImages.length ? manualImages.find((img) => img.id === imageId)?.url : undefined;

      const aiAttachments: Attachment[] | undefined = data.attachments;

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        text: aiText,
        sender: "ai",
        createdAt: new Date().toISOString(),
        imageUrl: selectedImageUrl ?? undefined,
        attachments: aiAttachments,
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMessage] } : s))
      );

      if (data.debug || data.tools || data.tool_calls) {
        setLastDebugInfo(data.debug || data.tools || data.tool_calls);
      } else {
        setLastDebugInfo(null);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.log("[Chat] Request abortada por el usuario.");
      } else {
        console.error("Error al conectar con el agente:", error);
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          text:
            "Hubo un problema al conectar con el agente. Revisa que el backend esté corriendo y que VITE_API_URL apunte al endpoint correcto.",
          sender: "ai",
          createdAt: new Date().toISOString(),
        };
        setSessions((prev) =>
          prev.map((s) => (s.id === currentSession.id ? { ...s, messages: [...s.messages, errorMessage] } : s))
        );
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* =========================================================
     Edit last message while loading
     ========================================================= */

  const handleEditLastMessage = () => {
    if (!loading) return;

    const activeSessionId = sessionIdRef.current || currentSession.id || null;
    if (!activeSessionId) return;

    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || session.messages.length === 0) return;

    const lastMsg = [...session.messages].reverse().find((m) => m.sender === "user");
    if (!lastMsg) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setSessions((prev) =>
      prev.map((s) => (s.id === activeSessionId ? { ...s, messages: s.messages.filter((m) => m.id !== lastMsg.id) } : s))
    );

    setInput(lastMsg.text);
    setLoading(false);
  };

  /* =========================================================
     Dashboard gap marker logic
     ========================================================= */

  const MARKER_GAP_MS = 30 * 60 * 1000;

  const formatGapStamp = (d: Date) => {
    const date = d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }).replace(".", "");
    const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return `${date} AT ${time}`.toUpperCase();
  };

  const shouldShowUserGapMarker = (messages: Message[], i: number) => {
    const msg = messages[i];
    if (msg.sender !== "user") return false;
    if (!isDashboard) return false;

    const cur = safeDate(msg.createdAt);
    if (!cur) return false;

    for (let j = i - 1; j >= 0; j--) {
      if (messages[j].sender === "user") {
        const prev = safeDate(messages[j].createdAt);
        if (!prev) return true;
        return cur.getTime() - prev.getTime() >= MARKER_GAP_MS;
      }
    }
    return true;
  };

  /* =========================================================
     Feedback (mock)
     ========================================================= */

  const handleAiFeedback = (messageId: string, dir: "up" | "down") => {
    console.log("[feedback]", { messageId, dir });
  };

  /* =========================================================
     Sidebar mock data
     ========================================================= */

  const quickActions = [
    { title: "Análisis de datos", description: "Procesar datos experimentales" },
    { title: "Protocolos", description: "Consultar procedimientos" },
    { title: "Reportes", description: "Generar documentación" },
    { title: "Configuración", description: "Ajustar parámetros" },
  ];

  const sharedFiles = [
    { id: "f1", name: "Resultados_placa_ELISA.xlsx", type: "Dataset" },
    { id: "f2", name: "Protocolo_cultivo_celular.pdf", type: "Protocolo" },
    { id: "f3", name: "Reporte_fallo_sensor.docx", type: "Reporte" },
  ];

  /* =========================================================
     UI: Small active agent chip (so activeAgent is not unused)
     ========================================================= */

  const ActiveAgentChip = activeAgent ? (
    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-gray-200 bg-white/80">
      {activeAgent.iconUrl ? (
        <img src={activeAgent.iconUrl} alt={activeAgent.name} className="w-4 h-4 rounded-full object-cover" />
      ) : (
        <div className="w-4 h-4 rounded-full bg-gray-200" />
      )}
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-gray-800 leading-none truncate">{activeAgent.name}</div>
        {activeAgent.subtitle ? (
          <div className="text-[10px] text-gray-500 leading-none truncate">{activeAgent.subtitle}</div>
        ) : null}
      </div>
    </div>
  ) : null;

  /* =========================================================
     UI: Sidebar
     ========================================================= */

  const SidebarUI = (
    <div
      data-chat-variant={resolvedVariant}
      className={`chatSidebarRoot bg-white border border-gray-200 flex flex-col overflow-hidden ${
        isPlanes ? "h-full w-full rounded-xl" : "h-full w-80 rounded-none border-0 border-r"
      }`}
    >
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 truncate">Lab Assistant</h1>
              <p className="text-sm text-gray-600 truncate">Asistente de laboratorio IA</p>
            </div>
          </div>

          <button
            onClick={handleNewSession}
            className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors"
            title="Nueva sesión"
          >
            +
          </button>
        </div>

        {/* chip del agente activo (opcional) */}
        {ActiveAgentChip ? <div className="mt-3">{ActiveAgentChip}</div> : null}
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {sidebarMode === "shortcuts"
              ? "Acciones rápidas"
              : sidebarMode === "tasks"
              ? "Tareas pendientes"
              : "Archivos compartidos"}
          </h3>

          <div className="inline-flex rounded-lg bg-gray-100 p-1 text-[11px]">
            <button
              onClick={() => setSidebarMode("tasks")}
              className={`px-2 py-1 rounded-md ${sidebarMode === "tasks" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              Pendientes
            </button>

            <button
              onClick={() => setSidebarMode("files")}
              className={`px-2 py-1 rounded-md ${sidebarMode === "files" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
            >
              Archivos
            </button>

            <button
              onClick={() => setSidebarMode("shortcuts")}
              className={`px-2 py-1 rounded-md ${
                sidebarMode === "shortcuts" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              Acciones
            </button>
          </div>
        </div>

        {sidebarMode === "shortcuts" && (
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="p-3 bg-gray-50 rounded-lg text-left hover:bg-gray-100 transition-colors"
                onClick={() => setInput(`Quiero usar la acción "${action.title}": ${action.description}.`)}
              >
                <div className="text-sm font-medium text-gray-900">{action.title}</div>
                <div className="text-xs text-gray-500 mt-1">{action.description}</div>
              </button>
            ))}
          </div>
        )}

        {sidebarMode === "tasks" && (
          <div className="space-y-3">
            {tasks.map((task) => {
              const due = new Date(task.dueDate).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });

              const modeLabel = task.chatMode === "individual" ? "Individual" : "Grupal";
              const ModeIcon = task.chatMode === "individual" ? UserIcon : Users;

              return (
                <button
                  key={task.id}
                  className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => handleOpenTask(task.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                        {task.chatMode && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white border border-gray-200 text-gray-700">
                            <ModeIcon className="w-3 h-3" />
                            {modeLabel}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</div>
                    </div>

                    <span className="text-[11px] text-gray-500 whitespace-nowrap">Entrega: {due}</span>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                      <span>Progreso</span>
                      <span>{task.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-1.5 bg-[#2f3136] rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}

            {tasks.length === 0 && <p className="text-xs text-gray-500">No tienes proyectos asignados vigentes.</p>}
          </div>
        )}

        {sidebarMode === "files" && (
          <div className="space-y-2">
            {sharedFiles.map((file) => (
              <button
                key={file.id}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() =>
                  setInput(`Quiero trabajar con el archivo "${file.name}" (${file.type}). Úsalo como contexto y ayúdame a avanzar en esta tarea.`)
                }
              >
                <div className="text-sm font-medium text-gray-900 truncate">{file.name}</div>
                <div className="text-xs text-gray-500 mt-1">Tipo: {file.type}</div>
              </button>
            ))}

            {sharedFiles.length === 0 && <p className="text-xs text-gray-500">No hay archivos compartidos todavía.</p>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900">Análisis Recientes</h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{sessions.length}</span>
          </div>

          <div className="flex gap-2 mb-4">
            {[
              { id: "all", label: "Todas" },
              { id: "today", label: "Hoy" },
              { id: "7d", label: "7 días" },
              { id: "30d", label: "30 días" },
            ].map((f) => {
              const active = sessionFilter === (f.id as SessionFilter);
              return (
                <button
                  key={f.id}
                  onClick={() => setSessionFilter(f.id as SessionFilter)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    active
                      ? "bg-[#2f3136] border-gray-600 text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {sessions.length === 0 && !sessionsLoading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-lg text-gray-400"> </span>
              </div>
              <p className="text-sm text-gray-500">
                {sessionFilter === "all" ? "No hay análisis guardados" : "No hay análisis en este rango de fechas"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const isActive = session.id === currentSession.id;

                const sessionTask = tasks.find((t) => t.sessionId === session.id || t.title === session.title);

                const chatMode: "group" | "individual" = sessionTask?.chatMode ?? "individual";
                const modeLabel = chatMode === "individual" ? "Individual" : "Grupal";
                const ModeIcon = chatMode === "individual" ? UserIcon : Users;

                const dateStr = new Date(session.createdAt).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                });

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    role="button"
                    className={`w-full text-left p-3 rounded-lg transition-all cursor-pointer ${
                      isActive ? "bg-gray-100 border border-gray-900" : "bg-white border border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {editingSessionId === session.id ? (
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={commitRenameSession}
                              onKeyDown={(e: any) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  commitRenameSession();
                                }
                                if (e.key === "Escape") {
                                  e.preventDefault();
                                  cancelRenameSession();
                                }
                              }}
                              className="w-full border border-gray-500 rounded px-2 py-1 text-sm outline-none"
                              autoFocus
                            />
                          ) : (
                            <span className="truncate block">{session.title}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{dateStr}</span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
                            <ModeIcon className="w-3 h-3" />
                            {modeLabel}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 ml-2">
                        {isActive && <div className="w-2 h-2 bg-gray-600 rounded-full" />}

                        <div className="flex items-center gap-1 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRenameSession(session);
                            }}
                            className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                            title="Renombrar sesión"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="p-1 rounded hover:bg-slate-50 text-slate-500 hover:text-red-700"
                            title="Eliminar sesión"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* =========================================================
     UI: Main chat
     ========================================================= */

  const MainChatUI = (
    <div
      data-chat-variant={resolvedVariant}
      className={`chatRoot flex flex-col min-h-0 ${
        isPlanes ? "h-full w-full bg-white rounded-xl border border-gray-200 overflow-hidden" : "h-full flex-1"
      }`}
    >
      {!isDashboard && (
        <header className="chatHeader bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{currentSession.title}</h2>
              <p className="text-sm text-gray-500 mt-1">{currentSession.messages.length} mensajes</p>

              {/* agente activo (si aplica) */}
              {activeAgent ? <div className="mt-2">{ActiveAgentChip}</div> : null}

              {(activeTask || currentChatMode) && (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-gray-50 text-gray-800 border border-emerald-100">
                    {currentChatMode === "individual" ? (
                      <UserIcon className="w-3 h-3 mr-1" />
                    ) : (
                      <Users className="w-3 h-3 mr-1" />
                    )}
                    {currentChatMode === "individual" ? "Chat individual" : "Chat grupal"}
                  </span>

                  {activeTask && (
                    <>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-gray-50 text-gray-800 border border-emerald-100">
                        Tarea: {activeTask.title}
                      </span>

                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] bg-gray-50 text-gray-700 border border-gray-200">
                        Entrega:{" "}
                        {new Date(activeTask.dueDate).toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>

                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <span>Progreso</span>
                        <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-1.5 bg-emerald-600 rounded-full" style={{ width: `${activeTask.progress}%` }} />
                        </div>
                        <span>{activeTask.progress}%</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      <div className="chatBody flex-1 min-h-0 overflow-y-auto bg-white">
        {sessionsLoading || messagesLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-sm text-gray-500">Cargando análisis...</div>
          </div>
        ) : currentSession.messages.length === 0 ? (
          isDashboard ? (
            <div className="h-full" />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl text-blue-600"> </span>
                </div>

                <h3 className="text-xl font-semibold text-gray-900 mb-3">Bienvenido al Laboratorio</h3>
                <p className="text-gray-600 mb-8">
                  Comienza un nuevo análisis o consulta para obtener asistencia inteligente en tus proyectos de laboratorio.
                </p>

                <div className="bg-gray-50 rounded-xl p-6 text-left">
                  <p className="text-sm font-medium text-gray-900 mb-4">Ejemplos:</p>
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>• "Analizar los datos del espectrómetro"</p>
                    <p>• "Revisar protocolo de seguridad química"</p>
                    <p>• "Generar reporte de control de calidad"</p>
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="max-w-3xl mx-auto py-4 px-4 space-y-4">
            {currentSession.messages.map((msg, i) => {
              const isUser = msg.sender === "user";
              const t = safeDate(msg.createdAt);
              const timeStr = t ? t.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : null;

              const showMarker = shouldShowUserGapMarker(currentSession.messages, i);
              const markerStr = t ? formatGapStamp(t) : null;

              if (isUser) {
                return (
                  <Fragment key={msg.id}>
                    {showMarker && markerStr && (
                      <div className="chatUserTimeMarker">
                        <div className="chatUserTimeMarker__line" />
                        <div className="chatUserTimeMarker__label">{markerStr}</div>
                        <div className="chatUserTimeMarker__line" />
                      </div>
                    )}

                    <div className="flex justify-end min-w-0">
                      <div className="min-w-0 max-w-full">
                        <div
                          className="chatUserBubble max-w-full md:max-w-md rounded-[10px] px-4 py-3 text-sm shadow-sm bg-[#2f3136] text-white"
                          style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                        >
                          <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                          {msg.pastedBlocks && msg.pastedBlocks.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.pastedBlocks.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  onClick={() => setPasteModal(b)}
                                  className="chatPastedCard w-full text-left rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 transition-colors p-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="chatPastedLabel text-[11px] tracking-[0.12em] font-semibold uppercase opacity-80">
                                      PASTED
                                    </span>

                                    {!isDashboard && <span className="text-[11px] opacity-70">{b.wordCount} palabras</span>}
                                  </div>

                                  {!isDashboard && <div className="mt-1 text-xs opacity-90 line-clamp-2">{b.title}</div>}
                                </button>
                              ))}
                            </div>
                          )}

                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {msg.attachments.map((att) =>
                                att.type === "image" ? (
                                  <div key={att.id} className="overflow-hidden rounded-xl">
                                    <img src={att.url} alt={att.name} className="w-full max-h-64 object-cover" />
                                  </div>
                                ) : (
                                  <a
                                    key={att.id}
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] underline text-emerald-100 hover:text-white"
                                  >
                                    {att.name}
                                  </a>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Fragment>
                );
              }

              return (
                <div key={msg.id} className="flex justify-start min-w-0">
                  <div className="w-full max-w-2xl min-w-0">
                    <div className="chatAiBubble rounded-[10px] px-4 py-3 text-sm bg-gray-50 text-gray-900 border border-gray-200 min-w-0">
                      <div className="prose prose-sm max-w-none min-w-0">
                        <ReactMarkdown
                          components={{
                            code({ inline, className, children, ...props }: any) {
                              const match = /language-(\w+)/.exec(className || "");
                              const language = match ? match[1] : "";
                              const value = String(children).replace(/\n$/, "");

                              if (!inline && language) {
                                return <CodeBlock language={language.toUpperCase()} value={value} />;
                              }

                              if (!inline) {
                                return (
                                  <div className="code-block my-4 rounded-xl bg-slate-900 border border-slate-700">
                                    <div className="code-block-content">
                                      <pre className="m-0 overflow-x-auto">
                                        <code className="block text-[13px] leading-relaxed font-mono text-slate-50 whitespace-pre" {...props}>
                                          {children}
                                        </code>
                                      </pre>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <code className="code-inline bg-slate-100 text-slate-900 px-1.5 py-0.5 rounded text-[0.85em] font-mono" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            pre({ children, ...props }: any) {
                              return <div {...props}>{children}</div>;
                            },
                            p({ children, ...props }: any) {
                              return (
                                <p className="mb-3 last:mb-0" {...props}>
                                  {children}
                                </p>
                              );
                            },
                            ul({ children, ...props }: any) {
                              return (
                                <ul className="mb-3 list-disc list-inside space-y-1" {...props}>
                                  {children}
                                </ul>
                              );
                            },
                            ol({ children, ...props }: any) {
                              return (
                                <ol className="mb-3 list-decimal list-inside space-y-1" {...props}>
                                  {children}
                                </ol>
                              );
                            },
                            li({ children, ...props }: any) {
                              return (
                                <li className="mb-1" {...props}>
                                  {children}
                                </li>
                              );
                            },
                            blockquote({ children, ...props }: any) {
                              return (
                                <blockquote className="border-l-4 border-gray-300 pl-4 py-1 my-3 text-gray-600 italic" {...props}>
                                  {children}
                                </blockquote>
                              );
                            },
                            table({ children, ...props }: any) {
                              return (
                                <div className="overflow-x-auto my-3">
                                  <table className="min-w-full divide-y divide-gray-300 text-sm" {...props}>
                                    {children}
                                  </table>
                                </div>
                              );
                            },
                            th({ children, ...props }: any) {
                              return (
                                <th className="px-3 py-2 bg-gray-100 text-left font-semibold border" {...props}>
                                  {children}
                                </th>
                              );
                            },
                            td({ children, ...props }: any) {
                              return (
                                <td className="px-3 py-2 border" {...props}>
                                  {children}
                                </td>
                              );
                            },
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>

                      {msg.imageUrl && (
                        <div className="mt-3 overflow-hidden rounded-xl">
                          <img src={msg.imageUrl} alt="Imagen generada por el asistente" className="w-full max-h-64 object-cover" />
                        </div>
                      )}

                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.attachments.map((att) =>
                            att.type === "image" ? (
                              <div key={att.id} className="overflow-hidden rounded-xl">
                                <img src={att.url} alt={att.name} className="w-full max-h-64 object-cover" />
                              </div>
                            ) : (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-800 underline"
                              >
                                {att.name}
                              </a>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-1 flex items-center justify-start gap-2 text-[11px] text-gray-500">
                      {timeStr ? <span>{timeStr}</span> : null}

                      <button
                        onClick={() => handleAiFeedback(msg.id, "up")}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Útil"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleAiFeedback(msg.id, "down")}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="No útil"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setInspectMsg(msg);
                          setInspectQuery("");
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Buscar en este mensaje (mock)"
                      >
                        <Search className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={copiedId === msg.id ? "Copiado" : "Copiar mensaje completo"}
                      >
                        {copiedId === msg.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <ChatThinkingIndicator />
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {showToolsPanel && lastDebugInfo && (
        <div className="border-t border-gray-200 bg-gray-900 text-gray-100 max-h-48 overflow-auto">
          <div className="px-4 py-2 bg-gray-800 flex items-center justify-between">
            <span className="text-sm font-medium">Información de Debug</span>
            <button onClick={() => setLastDebugInfo(null)} className="text-sm text-gray-400 hover:text-gray-200">
              X
            </button>
          </div>
          <pre className="text-xs p-4 whitespace-pre-wrap font-mono">{JSON.stringify(lastDebugInfo, null, 2)}</pre>
        </div>
      )}

      <div className="chatComposer bg-white border-t border-gray-200 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {pendingFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 text-xs text-gray-700">
              {pendingFiles.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 border border-gray-300 max-w-[220px]"
                >
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => handleRemovePendingFile(idx)} className="ml-1 text-gray-400 hover:text-gray-700">
                    X
                  </button>
                </div>
              ))}
            </div>
          )}

          {pastedBlocks.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              {pastedBlocks.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setPasteModal(b)}
                  className="chatPastedChip inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 max-w-full"
                >
                  <span className="chatPastedLabel text-[11px] font-semibold tracking-[0.12em] uppercase">PASTED</span>

                  {!isDashboard && (
                    <>
                      <span className="text-[11px] text-gray-500">{b.wordCount} palabras</span>
                      <span className="text-xs text-gray-800 truncate max-w-[220px]">{b.title}</span>
                    </>
                  )}

                  <span
                    className="ml-1 text-gray-400 hover:text-gray-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      removePastedBlock(b.id);
                    }}
                    title="Quitar"
                    role="button"
                  >
                    X
                  </span>
                </button>
              ))}
            </div>
          )}

          <div ref={composerBoxRef} className="chatComposerBox relative rounded-[10px] bg-white border border-gray-300 px-5 pt-4 pb-12">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => handleKeyPress(e as any)}
              onPaste={handleComposerPaste}
              placeholder={placeholder}
              rows={1}
              className="w-full bg-transparent text-gray-900 placeholder-gray-500 text-sm leading-relaxed resize-none border-0 outline-none pr-12"
              style={{ minHeight: 22, overflowWrap: "anywhere", wordBreak: "break-word" }}
              disabled={loading}
            />

            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && pendingFiles.length === 0 && pastedBlocks.length === 0)}
              className="chatSendBtn absolute right-4 bottom-4 w-10 h-10 rounded-full bg-[#2f3136] text-white flex items-center justify-center shadow-md hover:bg-[#2f3136] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>
          </div>

          <div className="chatFooter mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => setShowToolsPanel((v) => !v)} className="flex items-center gap-2">
                <span className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${showToolsPanel ? "bg-[#2f3136]" : "bg-gray-300"}`}>
                  <span
                    className={`inline-block h-4 w-4 bg-white rounded-full transform transition-transform translate-y-0.5 ${
                      showToolsPanel ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </span>
                <span className="chatFooterLabel">Show tool calls</span>
              </button>

              <button
                type="button"
                onClick={handleAttachClick}
                disabled={loading}
                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                <Paperclip className="w-3 h-3" />
                <span className="chatFooterLabel">Upload files or images</span>
              </button>

              <button
                ref={involvedBtnRef}
                type="button"
                onClick={openModelsPopup}
                className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800"
              >
                <span className="chatFooterLabel">Involved LLMs</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${modelsOpen ? "rotate-180" : ""}`} />
              </button>

              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesSelected} />
            </div>

            {loading && (
              <button onClick={handleEditLastMessage} className="chatFooterEdit text-gray-600 hover:text-gray-800">
                Editar mensaje
              </button>
            )}
          </div>
        </div>
      </div>

      {modelsOpen &&
        createPortal(
          <div data-chat-variant={resolvedVariant} className="chatPopoverOverlay" onMouseDown={() => setModelsOpen(false)}>
            <div onMouseDown={(e) => e.stopPropagation()} className="chatLlmPopover" style={{ top: modelsPos?.top ?? 120, left: modelsPos?.left ?? 24 }}>
              <div className="chatLlmPopoverHeader">
                <div className="chatLlmPopoverTitle">MODELS (MOCK)</div>

                <button type="button" onClick={() => setModelsOpen(false)} className="chatLlmPopoverClose" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1">
                {llmOptions.map((m) => {
                  const checked = selectedLlms.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className="chatLlmOption"
                      onClick={() => {
                        setSelectedLlms((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
                      }}
                    >
                      <span>{m}</span>
                      <span className={`chatLlmCheck ${checked ? "isOn" : ""}`} />
                    </button>
                  );
                })}
              </div>

              <div className="chatLlmPopoverFoot">UI-only por ahora.</div>
            </div>
          </div>,
          document.body
        )}

      {pasteModal &&
        createPortal(
          <div data-chat-variant={resolvedVariant} className="chatModalOverlay fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="chatModalCard w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden">
              <div className="chatModalHeader px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="chatPastedTag text-[11px] font-semibold tracking-[0.12em] uppercase">PASTED</div>

                  {!isDashboard && (
                    <>
                      <div className="chatPastedMeta text-[11px] mt-1">{pasteModal.wordCount} palabras</div>
                      <div className="chatPastedMeta text-sm font-semibold truncate">{pasteModal.title}</div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-xs rounded-lg border" onClick={() => navigator.clipboard.writeText(pasteModal.text)}>
                    Copiar
                  </button>
                  <button className="p-2 rounded-lg" onClick={() => setPasteModal(null)} title="Cerrar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 max-h-[70vh] overflow-auto">
                <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">{pasteModal.text}</pre>
              </div>
            </div>
          </div>,
          document.body
        )}

      {inspectMsg &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-gray-500">SEARCH (mock)</div>
                  <div className="text-sm font-semibold text-gray-900 truncate">Buscar en respuesta</div>
                </div>

                <button className="p-2 rounded-lg hover:bg-gray-100" onClick={() => setInspectMsg(null)} title="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 border-b border-gray-200">
                <input
                  value={inspectQuery}
                  onChange={(e) => setInspectQuery(e.target.value)}
                  placeholder="Escribe para buscar…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="p-4 max-h-[70vh] overflow-auto">
                {inspectQuery.trim() ? (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {(() => {
                      const q = inspectQuery.trim();
                      const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
                      const parts = inspectMsg.text.split(re);
                      return parts.map((p, idx) =>
                        re.test(p) ? (
                          <mark key={idx} className="bg-yellow-200/70 px-0.5 rounded">
                            {p}
                          </mark>
                        ) : (
                          <span key={idx}>{p}</span>
                        )
                      );
                    })()}
                  </div>
                ) : (
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words">{inspectMsg.text}</pre>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  /* =========================================================
     Render: planes vs page
     ========================================================= */

  if (isPlanes) {
    const needsUp = planes === "both" || planes === "upOnly";
    const needsDown = planes === "both" || planes === "downOnly";

    if ((needsUp && !upPlaneEl) || (needsDown && !downPlaneEl)) return null;

    return (
      <>
        {needsUp && upPlaneEl ? createPortal(SidebarUI, upPlaneEl) : null}
        {needsDown && downPlaneEl ? createPortal(MainChatUI, downPlaneEl) : null}
      </>
    );
  }

  return (
    <div className="h-full w-full bg-gray-50 flex overflow-hidden">
      {SidebarUI}
      {MainChatUI}
    </div>
  );
}
