// src/pages/Login.tsx
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login-ui.css";

import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

import heroVideo from "../assets/COBOT_Mockup.mp4";

// ============================================================================
// CUSTOM CURSOR - Crosshair with distortion effect
// ============================================================================

function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isOverInteractive, setIsOverInteractive] = useState(false);

  useEffect(() => {
    const checkInteractiveElement = (target: HTMLElement) => {
      const interactiveSelectors = ['button', 'input', 'textarea', 'a', 'select', '[role="button"]', '.toggle-link', '.social-button', '.forgot-password'];
      return interactiveSelectors.some(selector => 
        target.matches(selector) || target.closest(selector)
      );
    };

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      const isInteractive = checkInteractiveElement(e.target as HTMLElement);
      setIsOverInteractive(isInteractive);
      document.body.style.cursor = isInteractive ? 'auto' : 'none';
    };

    const handleMouseLeave = () => {
      setPosition({ x: -100, y: -100 });
      document.body.style.cursor = 'auto';
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      document.body.style.cursor = 'auto';
    };
  }, []);

  if (isOverInteractive || position.x < 0) return null;

  return (
    <>
      {/* Efecto de distorsión de fondo */}
      <div
        style={{
          position: "fixed",
          left: position.x - 60,
          top: position.y - 60,
          width: 120,
          height: 120,
          borderRadius: "50%",
          pointerEvents: "none",
          zIndex: 9998,
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
          background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
          transform: "scale(1)",
          transition: "transform 0.1s ease-out",
        }}
      />
      
      {/* Cursor crosshair */}
      <svg
        style={{
          position: "fixed",
          left: position.x - 16,
          top: position.y - 16,
          width: 32,
          height: 32,
          pointerEvents: "none",
          zIndex: 9999,
        }}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Esquinas bracket */}
        <path
          d="M6 12 L6 6 L12 6"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <path
          d="M20 6 L26 6 L26 12"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <path
          d="M26 20 L26 26 L20 26"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <path
          d="M12 26 L6 26 L6 20"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        
        {/* Cruz central */}
        <path
          d="M16 10 L16 13 M16 19 L16 22 M10 16 L13 16 M19 16 L22 16"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="1"
          strokeLinecap="square"
        />
        
        {/* Punto central */}
        <circle cx="16" cy="16" r="1.5" fill="rgba(255,255,255,0.85)" />
      </svg>
    </>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle } = useAuth() as any;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isElectron = useMemo(() => Boolean((window as any).electronAPI), []);

  useEffect(() => {
    window.electronAPI?.setWindowSize(800, 500);
    return () => {
      window.electronAPI?.setWindowSize(1200, 800);
    };
  }, []);

  const routeAfterAuth = async (authUserId: string) => {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, onboarding_completed, active_team_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (profileError) {
      console.error("Error consultando profiles:", profileError);
      navigate("/onboarding");
      return;
    }

    const onboardingOk = Boolean(profile?.onboarding_completed);
    const hasActiveTeam = Boolean(profile?.active_team_id);

    if (!profile || !onboardingOk || !hasActiveTeam) {
      navigate("/onboarding");
    } else {
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    const off = window.electronAPI?.onAuthCallback?.(async (rawUrl: string) => {
      try {
        setError(null);
        setLoading(true);

        const url = new URL(rawUrl);
        const code = url.searchParams.get("code");

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          const userId = data?.user?.id || data?.session?.user?.id;
          if (!userId)
            throw new Error("No se pudo obtener el usuario desde la sesión (code exchange).");

          await routeAfterAuth(userId);
          return;
        }

        const hash = (url.hash || "").replace(/^#/, "");
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) throw error;

          const userId = data?.user?.id || data?.session?.user?.id;
          if (!userId)
            throw new Error("No se pudo obtener el usuario desde la sesión (setSession).");

          await routeAfterAuth(userId);
          return;
        }

        throw new Error("Callback recibido, pero no venía 'code' ni tokens.");
      } catch (err: any) {
        console.error("Error procesando OAuth callback:", err);
        setError(err?.message || "No se pudo completar el login con Google.");
      } finally {
        setLoading(false);
      }
    });

    return () => off?.();
  }, [navigate]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = (form.get("usuario") as string) || "";
    const password = (form.get("contrasena") as string) || "";

    try {
      const authUser = isSignup
        ? await signup(email, password)
        : await login(email, password);

      if (!authUser) throw new Error("No se pudo obtener el usuario.");
      await routeAfterAuth(authUser.id);
    } catch (err: any) {
      console.error("Error en auth:", err);
      setError(err.message || "Ocurrió un error. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setLoading(true);

    try {
      if (!isElectron) {
        if (!loginWithGoogle) {
          console.warn("loginWithGoogle no está definido en AuthContext.");
          return;
        }
        await loginWithGoogle();
        return;
      }

      const redirectTo = "cora://auth/callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });

      if (error) throw error;

      const oauthUrl = data?.url;
      if (!oauthUrl)
        throw new Error("No se recibió la URL de OAuth desde Supabase.");

      if ((window as any).fredie?.openExternal) {
        (window as any).fredie.openExternal(oauthUrl);
      } else {
        window.open(oauthUrl, "_blank");
      }
    } catch (err: any) {
      console.error("Error en login con Google:", err);
      setError(err.message || "No se pudo iniciar sesión con Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <CustomCursor />
      <div className="login-frame">
        {/* Left Panel - Form */}
        <div className="login-left">
          <div className="login-form-wrapper">
            <div className="login-branding">
              <span className="brand-name">SENTINELA</span>
              <span className="brand-dot">•</span>
              <span className="brand-sub">by Ciclicall</span>
            </div>

            <div className="login-stack">
              <div className="login-header">
                <h1 className="login-title">
                  {isSignup ? "Create account" : "Welcome back!"}
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="login-form">
                <div className="form-field">
                  <label htmlFor="usuario" className="form-label">
                    Email
                  </label>
                  <input
                    id="usuario"
                    name="usuario"
                    type="email"
                    required
                    placeholder="Enter your email"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <div className="password-label-row">
                    <label htmlFor="contrasena" className="form-label">
                      Password
                    </label>
                    <div className="password-actions">
                      {!isSignup && (
                        <button type="button" className="forgot-password">
                          Forgot?
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="input-with-toggle">
                    <input
                      id="contrasena"
                      name="contrasena"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="Enter your password"
                      className="form-input"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {!isSignup && (
                  <div className="remember-me">
                    <input
                      type="checkbox"
                      id="remember"
                      name="remember"
                      className="remember-checkbox"
                    />
                    <label htmlFor="remember" className="remember-label">
                      Remember me
                    </label>
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}

                <button type="submit" disabled={loading} className="login-button">
                  {loading
                    ? isSignup
                      ? "Creating..."
                      : "Signing in..."
                    : isSignup
                    ? "Create account"
                    : "Login"}
                </button>
              </form>

              {!isSignup && (
                <>
                  <div className="divider">
                    <div className="divider-line" />
                    <span className="divider-text">or</span>
                    <div className="divider-line" />
                  </div>

                  <div className="social-buttons">
                    <button
                      type="button"
                      className="social-button"
                      disabled
                      title="Facebook login not configured"
                    >
                      <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                      </svg>
                      Facebook
                    </button>

                    <button
                      type="button"
                      className="social-button"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                    >
                      <svg className="social-icon" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Google
                    </button>
                  </div>
                </>
              )}

              <div className="login-footer">
                {isSignup ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignup(false);
                        setError(null);
                      }}
                      className="toggle-link"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignup(true);
                        setError(null);
                      }}
                      className="toggle-link"
                    >
                      Create one
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Video */}
        <div className="login-right">
          <div className="login-hero">
            <video
              className="hero-video"
              src={heroVideo}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
            <div className="hero-overlay" />
            <div className="hero-tagline">
              <h2 className="hero-caption">
                Your on-demand
                <br />
                lab researcher
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}