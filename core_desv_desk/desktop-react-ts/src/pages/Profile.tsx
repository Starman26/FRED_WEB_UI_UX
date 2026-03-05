// src/pages/Profile.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Camera, Loader2, Save, User, Mail, Building2, GraduationCap, Shield } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "../styles/profile-ui.css";

const ROOT_COLLAPSED_CLASS = "cora-sidebar-collapsed";
const LS_KEY = "cora.sidebarCollapsed";

type LearningStyle = "visual" | "auditivo" | "kinestesico" | "mixto";

// Matches public.profiles table exactly
type ProfileRow = {
  id: string;                       // uuid PK
  auth_user_id: string;             // uuid
  email: string | null;             // text
  full_name: string | null;         // text
  career: string | null;            // text
  semester: number | null;          // int4
  skills: string[] | null;          // _text (text[])
  goals: string[] | null;           // _text (text[])
  interests: string[] | null;       // _text (text[])
  learning_style: { mode?: LearningStyle } | null; // jsonb
  last_seen: string | null;         // timestamptz
  onboarding_completed: boolean | null; // bool
  created_at: string | null;        // timestamptz
  updated_at: string | null;        // timestamptz
  active_team_id: string | null;    // uuid
  learning_profile_text: string | null; // text
};

const AVATARS_BUCKET = "avatars";

async function loadHeaderProfile(user: any): Promise<{ name: string; role: string | null }> {
  if (!user) return { name: "", role: null };
  let baseName = user.email?.split("@")[0] ?? "";
  let role: string | null = null;

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
    const { data: membershipData } = await supabase
      .from("team_memberships")
      .select("role")
      .eq("auth_user_id", user.id)
      .eq("team_id", profileData.active_team_id)
      .maybeSingle();
    if (membershipData?.role) role = membershipData.role;
  }

  return { name: baseName, role };
}

// ============================================================================
// HEADER
// ============================================================================

interface ProfileHeaderProps {
  userName: string;
  userRole: string;
  userError?: string | null;
}

function ProfileHeader({ userName, userRole, userError }: ProfileHeaderProps) {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_KEY) === "1"; } catch { return false; }
  });

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

  const displayName = userName || "User";
  const displayRole = userRole || null;

  return (
    <>
      <header className="prof_header">
        <div className="prof_headerLeft">
          <button type="button" onClick={toggleSidebar} className="prof_menuBtn" aria-label="Toggle sidebar">
            <Menu size={18} />
          </button>
          <div className="prof_headerDivider" />
          <div className="prof_userInfo">
            <span className="prof_pageName">My Profile</span>
            <span className="prof_pathSeparator">/</span>
            <span className="prof_userName">{displayName}</span>
            {displayRole && (
              <>
                <span className="prof_userSeparator">/</span>
                <span className="prof_userRole">{displayRole}</span>
              </>
            )}
          </div>
          {userError && <span className="prof_userError">({userError})</span>}
        </div>
        <div className="prof_headerRight">
          <button type="button" className="prof_headerBtn">Feedback</button>
          <button type="button" className="prof_headerBtn" onClick={() => navigate("/notebook")}>Notebook</button>
        </div>
      </header>
    </>
  );
}

// ============================================================================
// PROFILE PAGE — reads/writes from public.profiles
// ============================================================================

export default function ProfilePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userLoadError, setUserLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fields from profiles table
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [career, setCareer] = useState("");
  const [semester, setSemester] = useState<number | "">("");
  const [skills, setSkills] = useState("");
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState("");
  const [learningStyle, setLearningStyle] = useState<LearningStyle>("visual");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState<string | null>(null);

  // ── Load from public.profiles ──
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (!alive) return;
      if (authErr || !authData?.user) { setUserLoadError("Not authenticated"); setLoading(false); return; }
      const user = authData.user;
      setUserId(user.id);

      // Header info
      try {
        const hp = await loadHeaderProfile(user);
        if (!alive) return;
        setUserName(hp.name);
        setUserRole(hp.role);
        setMemberRole(hp.role);
      } catch { if (alive) setUserLoadError("Error loading profile"); }

      // Read from profiles table
      const { data: row, error: profErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle<ProfileRow>();

      if (profErr) {
        console.error("Error loading profile:", profErr);
        if (alive) setLoading(false);
        return;
      }

      if (alive && row) {
        setEmail(row.email ?? user.email ?? "");
        setFullName(row.full_name ?? "");
        setCareer(row.career ?? "");
        setSemester(row.semester ?? "");
        setSkills(Array.isArray(row.skills) ? row.skills.join(", ") : "");
        setGoals(Array.isArray(row.goals) ? row.goals.join(", ") : "");
        setInterests(Array.isArray(row.interests) ? row.interests.join(", ") : "");
        setLearningStyle((row.learning_style as any)?.mode ?? "visual");
        // avatar_url not in profiles table — skip for now
      } else if (alive) {
        setEmail(user.email ?? "");
      }

      if (alive) setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, []);

  const displayName = fullName?.trim() || email?.split("@")[0] || "";
  const initial = displayName.charAt(0).toUpperCase() || "?";

  const roleLabel = memberRole === "admin_equipos"
    ? "Team Admin"
    : memberRole === "laboratorista"
    ? "Lab Technician"
    : memberRole || "No role assigned";

  // ── Save to public.profiles ──
  const handleSave = async () => {
    if (!userId) return;
    setSaving(true); setSaveSuccess(false);

    // Convert comma-separated strings to arrays
    const toArray = (s: string) => s ? s.split(",").map((v) => v.trim()).filter(Boolean) : null;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        career: career || null,
        semester: semester === "" ? null : Number(semester),
        skills: toArray(skills),
        goals: toArray(goals),
        interests: toArray(interests),
        learning_style: { mode: learningStyle },
        updated_at: new Date().toISOString(),
      })
      .eq("auth_user_id", userId);

    if (!error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      console.error("Error saving profile:", error);
    }
    setSaving(false);
  };

  // ── Avatar (stored in Supabase Storage, URL saved to profiles if column exists) ──
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) return;
    const file = e.target.files?.[0]; if (!file) return;
    try {
      setUploadingAvatar(true);
      const ext = file.name.split(".").pop() || "png";
      const filePath = `${userId}/${Date.now()}.${ext}`;
      const { error: ue } = await supabase.storage.from(AVATARS_BUCKET).upload(filePath, file, { upsert: true });
      if (ue) { console.error("Upload error:", ue); setUploadingAvatar(false); return; }
      const { data: { publicUrl } } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(filePath);
      setAvatarUrl(publicUrl);
    } finally { setUploadingAvatar(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  // ── Render ──
  return (
    <div className="prof_root">
      <ProfileHeader userName={userName} userRole={userRole || ""} userError={userLoadError} />

      <main className="prof_content">
        {loading ? (
          <div className="prof_loadingWrapper">
            <Loader2 size={18} className="prof_spin" />
            <span>Loading profile...</span>
          </div>
        ) : (
          <div className="prof_grid">
            {/* Left: Avatar card */}
            <div className="prof_left">
              <div className="prof_card prof_avatarCard">
                <div className="prof_avatarWrapper">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="prof_avatarImg" />
                  ) : (
                    <div className="prof_avatarFallback">{initial}</div>
                  )}
                  <button type="button" onClick={handleAvatarClick} disabled={uploadingAvatar} className="prof_avatarBtn">
                    {uploadingAvatar ? <Loader2 size={14} className="prof_spin" /> : <Camera size={14} />}
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="prof_hidden" onChange={handleAvatarChange} />
                </div>
                <h2 className="prof_displayName">{displayName}</h2>
                <p className="prof_email">{email}</p>
                <div className="prof_roleBadge"><Shield size={12} /><span>{roleLabel}</span></div>
              </div>
            </div>

            {/* Right: Settings cards */}
            <div className="prof_right">
              {/* Personal */}
              <div className="prof_card">
                <div className="prof_cardHeader">
                  <h3 className="prof_cardTitle">Personal Information</h3>
                  <p className="prof_cardDesc">Basic profile details</p>
                </div>
                <div className="prof_fieldGrid">
                  <div className="prof_field">
                    <label className="prof_label"><User size={13} /> Full Name</label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="prof_input" />
                  </div>
                  <div className="prof_field">
                    <label className="prof_label"><Mail size={13} /> Email</label>
                    <input type="email" value={email} disabled className="prof_input prof_input--disabled" />
                    <span className="prof_hint">Managed by auth provider</span>
                  </div>
                </div>
              </div>

              {/* Academic */}
              <div className="prof_card">
                <div className="prof_cardHeader">
                  <h3 className="prof_cardTitle">Academic Details</h3>
                  <p className="prof_cardDesc">Used to personalize your experience</p>
                </div>
                <div className="prof_fieldGrid">
                  <div className="prof_field">
                    <label className="prof_label"><Building2 size={13} /> Career / Program</label>
                    <input type="text" value={career} onChange={(e) => setCareer(e.target.value)} placeholder="e.g. IMT, BME, IMD" className="prof_input" />
                  </div>
                  <div className="prof_field">
                    <label className="prof_label"><GraduationCap size={13} /> Semester</label>
                    <input type="number" min={1} max={20} value={semester} onChange={(e) => setSemester(e.target.value === "" ? "" : Number(e.target.value))} placeholder="e.g. 5" className="prof_input" />
                  </div>
                </div>
              </div>

              {/* Skills, Goals, Interests */}
              <div className="prof_card">
                <div className="prof_cardHeader">
                  <h3 className="prof_cardTitle">Skills, Goals & Interests</h3>
                  <p className="prof_cardDesc">Separate multiple values with commas</p>
                </div>
                <div className="prof_fieldStack">
                  <div className="prof_field">
                    <label className="prof_label">Skills</label>
                    <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Python, CAD, Statistics" className="prof_input" />
                  </div>
                  <div className="prof_field">
                    <label className="prof_label">Goals</label>
                    <input type="text" value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. Graduate with honors, Learn ML" className="prof_input" />
                  </div>
                  <div className="prof_field">
                    <label className="prof_label">Interests</label>
                    <input type="text" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g. Robotics, AI, Sustainability" className="prof_input" />
                  </div>
                </div>
              </div>

              {/* Learning Style */}
              <div className="prof_card">
                <div className="prof_cardHeader">
                  <h3 className="prof_cardTitle">Learning Style</h3>
                  <p className="prof_cardDesc">Sentinela adapts responses based on your preference</p>
                </div>
                <div className="prof_styleGrid">
                  {([
                    { value: "visual" as LearningStyle, label: "Visual", desc: "Diagrams, charts, visual aids" },
                    { value: "auditivo" as LearningStyle, label: "Auditory", desc: "Verbal explanations, discussions" },
                    { value: "kinestesico" as LearningStyle, label: "Kinesthetic", desc: "Hands-on exercises, practice" },
                    { value: "mixto" as LearningStyle, label: "Mixed", desc: "Combination of all styles" },
                  ]).map((s) => (
                    <button key={s.value} type="button" className={`prof_styleOption ${learningStyle === s.value ? "is-selected" : ""}`} onClick={() => setLearningStyle(s.value)}>
                      <span className="prof_styleLabel">{s.label}</span>
                      <span className="prof_styleDesc">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="prof_saveBar">
                {saveSuccess && (
                  <span className="prof_saveSuccess">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    Changes saved
                  </span>
                )}
                <button type="button" onClick={handleSave} disabled={saving} className="prof_saveBtn">
                  {saving ? <Loader2 size={15} className="prof_spin" /> : <Save size={15} />}
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}