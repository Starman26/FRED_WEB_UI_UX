// src/pages/SectionPage.tsx
import { useEffect, useState } from "react";
import {
  Sparkles,
  Settings2,
  RotateCcw,
  Save,
  Palette,
  Moon,
  Sun,
  Monitor,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// Avatares
import CatAvatarImg from "../assets/caticon.png";
import RobotAvatarImg from "../assets/roboticon.png";
import DuckAvatarImg from "../assets/duckicon.png";
import ExplorerAvatarImg from "../assets/explorericon.png";
import LabAvatarImg from "../assets/labicon.png";
import CoraAvatarImg from "../assets/coraicon.png";

import WidgetPositioner from "../components/WidgetPositioner";

// ======================== AVATARS ========================

type AvatarConfig = {
  id: string;
  name: string;
  personality: string;
  notes: string;
  image: string;
  gradient: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
};

const AVATARS: AvatarConfig[] = [
  {
    id: "cora",
    name: "Cora (Básico)",
    personality:
      "Equilibrado, claro y enfocado en ayudarte en el laboratorio y tus proyectos.",
    notes:
      "Modo recomendado para la mayoría de los usuarios. Respuestas claras, concisas y amables.",
    image: CoraAvatarImg,
    gradient: "from-gray-100 to-gray-200",
    bgLight: "bg-slate-50",
    borderColor: "border-slate-200",
    textColor: "text-slate-600",
  },
  {
    id: "cat",
    name: "Gato Analítico",
    personality:
      "Curioso, paciente y explicativo. Me tomo el tiempo necesario para entender cada problema.",
    notes: "Perfecto para estudiar o depurar código paso a paso.",
    image: CatAvatarImg,
    gradient: "from-gray-100 to-gray-200",
    bgLight: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-600",
  },
  {
    id: "robot",
    name: "Robot Industrial",
    personality:
      "Preciso, directo y orientado a la automatización industrial.",
    notes: "Ideal para PLCs, visión artificial y KPIs técnicos.",
    image: RobotAvatarImg,
    gradient: "from-gray-100 to-gray-200",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-200",
    textColor: "text-sky-600",
  },
  {
    id: "duck",
    name: "Pato Caótico",
    personality: "Creativo y caótico-bueno. Brainstorming sin límites.",
    notes: "Perfecto para desbloquear ideas y prototipos rápidos.",
    image: DuckAvatarImg,
    gradient: "from-gray-100 to-gray-200",
    bgLight: "bg-yellow-50",
    borderColor: "border-yellow-200",
    textColor: "text-yellow-600",
  },
  {
    id: "lab",
    name: "Asistente de Lab",
    personality:
      "Metódico y clínico. Ideal para prácticas y reportes de laboratorio.",
    notes: "Protocolos, pasos claros y enfoque científico.",
    image: LabAvatarImg,
    gradient: "from-gray-100 to-gray-200",
    bgLight: "bg-emerald-50",
    borderColor: "border-gray-200",
    textColor: "text-emerald-600",
  },
  {
    id: "astro",
    name: "Explorador XR",
    personality: "Futurista, experimental, orientado a VR/AR.",
    notes: "Para proyectos en Unity, XR y nuevas interfaces.",
    image: ExplorerAvatarImg,
    gradient: "from-gray-100 to-gray-200",
    bgLight: "bg-violet-50",
    borderColor: "border-violet-200",
    textColor: "text-violet-600",
  },
];

const DEFAULT_AVATAR = AVATARS[0];

// ======================== PAGE ========================

export default function Config() {
  const { user } = useAuth();

  const [selectedId, setSelectedId] = useState<string>(DEFAULT_AVATAR.id);
  const [configMode, setConfigMode] = useState<"default" | "custom">("default");
  const [customPersonality, setCustomPersonality] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedAvatar =
    AVATARS.find((avatar) => avatar.id === selectedId) ?? DEFAULT_AVATAR;

  const displayedPersonality =
    configMode === "default" ? selectedAvatar.personality : customPersonality;
  const displayedNotes =
    configMode === "default" ? selectedAvatar.notes : customNotes;

  // ================= LOAD FROM SUPABASE =================

  useEffect(() => {
    const load = async () => {
      if (!user) return setLoading(false);

      const { data } = await supabase
        .from("profiles")
        .select(
          "widget_avatar_id, widget_mode, widget_personality, widget_notes"
        )
        .eq("auth_user_id", user.id)
        .single();

      if (data) {
        if (data.widget_avatar_id) setSelectedId(data.widget_avatar_id);
        if (data.widget_mode) setConfigMode(data.widget_mode);
        if (data.widget_personality)
          setCustomPersonality(data.widget_personality);
        if (data.widget_notes) setCustomNotes(data.widget_notes);
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    const payload = {
      widget_avatar_id: selectedId,
      widget_mode: configMode,
      widget_personality: configMode === "custom" ? customPersonality : null,
      widget_notes: configMode === "custom" ? customNotes : null,
    };

    await supabase
      .from("profiles")
      .update(payload)
      .eq("auth_user_id", user.id);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-400 text-sm">
        Cargando configuración del widget…
      </div>
    );
  }

  const personalityDisabled = configMode === "default";

  return (
    <div className="h-full w-full bg-[#f3f4f6] flex overflow-hidden">
      {/* ============== LEFT SIDEBAR ============== */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
            Configuración
          </p>
          <h1 className="text-xl font-semibold text-gray-900">Widget Cora</h1>
          <p className="text-sm text-gray-600 mt-1">
            Personaliza tu asistente visual.
          </p>
        </div>

        <div className="p-4 border-b border-gray-200">
          <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-3">
            Perfiles disponibles
          </h3>

          <div className="grid grid-cols-1 gap-2">
            {AVATARS.map((avatar) => {
              const active = avatar.id === selectedId;
              return (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedId(avatar.id)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all
                    ${
                      active
                        ? "bg-gray-50 border-gray-300 shadow-sm ring-1 ring-gray-200/70"
                        : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                >
                  {/* Radio-style circle */}
                  <span
                    className={`
                      relative flex items-center justify-center
                      w-4 h-4 rounded-full border
                      ${
                        active
                          ? "border-slate-400 bg-slate-400 shadow-[0_0_0_4px_rgba(111,191,36,0.25)]"
                          : "border-gray-300 bg-white"
                      }
                    `}
                  >
                    {active && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>

                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-gray-900">
                      {avatar.name}
                    </p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {avatar.personality}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        <div className="p-4 text-sm text-gray-600 space-y-2">
          <h3 className="font-medium text-gray-900">Resumen</h3>
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[13px]">
            Avatar activo: <b>{selectedAvatar.name}</b>
          </div>
          <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[13px]">
            Modo:{" "}
            <b>{configMode === "default" ? "Recomendado" : "Personalizado"}</b>
          </div>
        </div>
      </aside>

      {/* ============== RIGHT PANEL ============== */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Ajustes del asistente
            </h2>
            <p className="text-sm text-gray-500">
              Controla comportamiento, estilo y posición.
            </p>
          </div>

          {/* Toggle modo recomendado/personalizado */}
          <div className="inline-flex items-center rounded-full bg-gray-100 p-1 text-xs">
            <button
              onClick={() => setConfigMode("default")}
              className={`px-3 py-1 rounded-full transition ${
                configMode === "default"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500"
              }`}
            >
              Recomendado
            </button>
            <button
              onClick={() => setConfigMode("custom")}
              className={`px-3 py-1 rounded-full transition ${
                configMode === "custom"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500"
              }`}
            >
              Personalizado
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-5xl mx-auto">
          {/* ===== PREVIEW CARD ===== */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gray-900 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  Vista previa
                </p>
              </div>
              <p className="text-[11px] text-gray-500">
                Así verás a tu asistente en el escritorio.
              </p>
            </div>

            <div className="flex justify-center mb-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedAvatar.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`h-32 w-32 rounded-3xl bg-gradient-to-br ${selectedAvatar.gradient} flex items-center justify-center shadow`}
                >
                  <img src={selectedAvatar.image} className="h-24 w-24" />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="text-center max-w-md mx-auto">
              <p className="font-semibold text-gray-900">
                {selectedAvatar.name}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {selectedAvatar.personality}
              </p>
            </div>
          </div>

          {/* ===== PERSONALITY CONFIG ===== */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">
                Personalidad
              </p>
              <p className="text-[11px] text-gray-500">
                {configMode === "default"
                  ? "Usando la descripción recomendada del perfil."
                  : "Edita libremente cómo se comporta el asistente."}
              </p>
            </div>

            <textarea
              disabled={personalityDisabled}
              className={`w-full min-h-[80px] text-sm rounded-xl px-3 py-2 resize-none transition-colors border
                ${
                  personalityDisabled
                    ? "bg-gray-50 border-dashed border-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
                }`}
              value={displayedPersonality}
              onChange={(e) =>
                configMode === "custom" &&
                setCustomPersonality(e.target.value)
              }
            />

            <p className="text-sm font-semibold text-gray-900 mt-4 mb-1 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Notas adicionales
            </p>

            <textarea
              disabled={personalityDisabled}
              className={`w-full min-h-[80px] text-sm rounded-xl px-3 py-2 resize-none transition-colors border
                ${
                  personalityDisabled
                    ? "bg-gray-50 border-dashed border-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-white border-gray-300 focus:outline-none focus:ring-2 focus:ring-slate-500/30"
                }`}
              value={displayedNotes}
              onChange={(e) =>
                configMode === "custom" && setCustomNotes(e.target.value)
              }
            />

            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <button
                onClick={() => {
                  setConfigMode("default");
                  setCustomNotes("");
                  setCustomPersonality("");
                }}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Restablecer a valores por defecto
              </button>

              <button
                onClick={handleSave}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs text-white bg-gradient-to-r ${selectedAvatar.gradient} shadow-sm`}
              >
                <Save className="w-3.5 h-3.5" />
                {saved ? "Guardado" : "Guardar cambios"}
              </button>
            </div>
          </div>

          {/* ===== WIDGET POSITION ===== */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center">
                <Monitor className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Posición del widget
                </p>
                <p className="text-xs text-gray-500">
                  Arrastra el punto para elegir en qué lugar aparece el
                  widget.
                </p>
              </div>
            </div>

            <WidgetPositioner />
          </div>

          {/* ===== THEME PREVIEW (placeholder) ===== */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-gray-900 flex items-center justify-center">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Tema de la aplicación
                </p>
                <p className="text-xs text-gray-500">Próximamente disponible</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60 pointer-events-none">
              <div className="border rounded-xl p-4 bg-gray-50 flex gap-3 items-center">
                <Sun className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="font-medium text-sm text-gray-800">Claro</p>
                  <p className="text-xs text-gray-500">Interfaz luminosa.</p>
                </div>
              </div>

              <div className="border rounded-xl p-4 bg-gray-800 flex gap-3 items-center text-white">
                <Moon className="w-6 h-6" />
                <div>
                  <p className="font-medium text-sm">Oscuro</p>
                  <p className="text-xs text-gray-300">
                    Reduce fatiga visual.
                  </p>
                </div>
              </div>

              <div className="border rounded-xl p-4 bg-gray-100 flex gap-3 items-center">
                <Monitor className="w-6 h-6 text-gray-700" />
                <div>
                  <p className="font-medium text-sm text-gray-800">
                    Automático
                  </p>
                  <p className="text-xs text-gray-500">
                    Se adapta a tu sistema.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
