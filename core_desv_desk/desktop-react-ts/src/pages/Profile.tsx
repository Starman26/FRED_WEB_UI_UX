// src/pages/Profile.tsx
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

type LearningStyle = "visual" | "auditivo" | "kinestesico" | "mixto";

type StudentRow = {
  full_name: string | null;
  email: string | null;
  career: string | null;
  semester: number | null;
  learning_style: { mode?: LearningStyle } | null;
  avatar_url: string | null;
};

type AppUserRow = {
  role: "admin_equipos" | "laboratorista" | null;
};

const AVATARS_BUCKET = "avatars";

export default function ProfilePage() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<StudentRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [roleLabel, setRoleLabel] = useState<string>("Sin rol asignado");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Campos editables
  const [career, setCareer] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [learningStyle, setLearningStyle] = useState<LearningStyle>("visual");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // ==========================
  // Cargar perfil + rol
  // ==========================
  useEffect(() => {
    async function loadProfile() {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("students")
        .select(
          "full_name, email, career, semester, learning_style, avatar_url"
        )
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error cargando perfil:", error);
        setLoading(false);
        return;
      }

      const row: StudentRow = {
        full_name: data?.full_name ?? user.email ?? "",
        email: data?.email ?? user.email ?? "",
        career: data?.career ?? "",
        semester: data?.semester ?? null,
        learning_style: data?.learning_style ?? { mode: "visual" },
        avatar_url: data?.avatar_url ?? null,
      };

      setProfile(row);
      setCareer(row.career ?? "");
      setSemester(row.semester ?? "");
      setLearningStyle(
        (row.learning_style?.mode as LearningStyle) || "visual"
      );
      setAvatarUrl(row.avatar_url);

      const { data: appUser, error: appUserError } = await supabase
        .from("app_user")
        .select("role")
        .eq("id", user.id)
        .maybeSingle<AppUserRow>();

      if (appUserError) {
        console.error("Error cargando rol en Profile:", appUserError);
        setRoleLabel("Sin rol asignado");
      } else {
        const role = appUser?.role;
        if (role === "admin_equipos") setRoleLabel("Administrador de equipos");
        else if (role === "laboratorista") setRoleLabel("Laboratorista");
        else setRoleLabel("Sin rol asignado");
      }

      setLoading(false);
    }

    loadProfile();
  }, [user]);

  const fullName = profile?.full_name || user?.email || "";
  const email = profile?.email || user?.email || "";
  const initial =
    fullName?.trim()?.charAt(0)?.toUpperCase() ||
    email?.trim()?.charAt(0)?.toUpperCase() ||
    "?";

  // ==========================
  // Guardar perfil
  // ==========================
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("students")
      .update({
        career: career || null,
        semester: semester === "" ? null : Number(semester),
        learning_style: { mode: learningStyle },
      })
      .eq("auth_user_id", user.id);

    if (error) {
      console.error("Error guardando perfil:", error);
    }

    setSaving(false);
  };

  // ==========================
  // Avatar
  // ==========================
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingAvatar(true);

      const ext = file.name.split(".").pop() || "png";
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        console.error("[Avatar] Error subiendo avatar:", uploadError);
        alert("No se pudo subir la imagen de perfil.");
        setUploadingAvatar(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("students")
        .update({ avatar_url: publicUrl })
        .eq("auth_user_id", user.id);

      if (updateError) {
        console.error("[Avatar] Error actualizando avatar_url:", updateError);
        alert("La imagen se subió pero no se pudo guardar en tu perfil.");
        setUploadingAvatar(false);
        return;
      }

      setAvatarUrl(publicUrl);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ==========================
  // Loading
  // ==========================
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Cargando perfil…</span>
        </div>
      </div>
    );
  }

  // ==========================
  // UI
  // ==========================
  return (
    <div className="space-y-6">
      {/* HEADER PÁGINA */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mi perfil</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administra tus datos y cómo FrEDie se adapta a tu forma de aprender.
          </p>
        </div>

        <div className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-medium">
          {roleLabel}
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: avatar + info básica */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 lg:col-span-1">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-28 h-28 rounded-full object-cover bg-gray-100"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-emerald-700 flex items-center justify-center text-3xl font-semibold text-white">
                  {initial}
                </div>
              )}

              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-50 transition"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-700" />
                ) : (
                  <Camera className="w-4 h-4 text-gray-700" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            <div className="text-center space-y-1">
              <p className="text-base font-semibold text-gray-900">
                {fullName}
              </p>
              <p className="text-sm text-gray-500">{email}</p>
              <p className="text-xs text-gray-400">
                Tu rol en la plataforma define qué herramientas ves en FrEDie.
              </p>
            </div>
          </div>
        </section>

        {/* Columna derecha: datos académicos y estilo de aprendizaje */}
        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Preferencias académicas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Carrera */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Carrera
              </label>
              <input
                type="text"
                value={career}
                onChange={(e) => setCareer(e.target.value)}
                placeholder="Ej. IMT, BME, IMD…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>

            {/* Semestre */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Semestre
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={semester}
                onChange={(e) =>
                  setSemester(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                placeholder="Ej. 5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Estilo de aprendizaje */}
          <div className="mt-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Estilo de aprendizaje
            </label>
            <select
              value={learningStyle}
              onChange={(e) =>
                setLearningStyle(e.target.value as LearningStyle)
              }
              className="w-full md:w-1/2 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
            >
              <option value="visual">Visual</option>
              <option value="auditivo">Auditivo</option>
              <option value="kinestesico">Kinestésico</option>
              <option value="mixto">Mixto</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              FrEDie puede ajustar ejemplos, tipo de explicaciones y ritmo
              tomando en cuenta esta preferencia.
            </p>
          </div>

          {/* Botón guardar */}
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" />
              )}
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
