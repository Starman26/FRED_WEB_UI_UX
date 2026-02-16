import {
  useState,
  useEffect,
  useRef,
  InputHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "../styles/onboarding.css";

import {
  Check,
  BookOpen,
  Eye,
  FileText,
  Wrench,
  ListOrdered,
  Users,
  Plus,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

// ============================================================================
// TYPES
// ============================================================================

type WorkspaceMode = "join" | "create";

interface LearningStyle {
  prefersTheory: boolean;
  prefersVisual: boolean;
  prefersExamples: boolean;
  prefersPractice: boolean;
  prefersStepByStep: boolean;
}

type TeamRole = "admin" | "lab_researcher";

// ============================================================================
// PARTICLE GRID - Dot grid with mouse repulsion effect
// ============================================================================

interface Dot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
}

function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -200, y: -200 });
  const targetRef = useRef({ x: -200, y: -200 });
  const dotsRef = useRef<Dot[]>([]);
  const animationRef = useRef<number | null>(null);
  const isOverInteractiveRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Configuración - Deformación muy aumentada
    const GRID_SPACING = 18;
    const INFLUENCE_RADIUS = 200;
    const PUSH_STRENGTH = 50;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);

      const dots: Dot[] = [];
      for (let x = 0; x < window.innerWidth + GRID_SPACING; x += GRID_SPACING) {
        for (let y = 0; y < window.innerHeight + GRID_SPACING; y += GRID_SPACING) {
          dots.push({ x, y, baseX: x, baseY: y });
        }
      }
      dotsRef.current = dots;
    };

    setupCanvas();

    const checkInteractiveElement = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const interactiveSelectors = ['button', 'input', 'textarea', 'a', 'select', '[role="button"]', '.toggle-link'];
      const isInteractive = interactiveSelectors.some(selector => 
        target.matches(selector) || target.closest(selector)
      );
      isOverInteractiveRef.current = isInteractive;
      document.body.style.cursor = isInteractive ? 'auto' : 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      checkInteractiveElement(e);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleMouseLeave = () => {
      targetRef.current = { x: -200, y: -200 };
      document.body.style.cursor = 'auto';
    };

    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    const animate = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const ease = 0.15;
      mouseRef.current.x += (targetRef.current.x - mouseRef.current.x) * ease;
      mouseRef.current.y += (targetRef.current.y - mouseRef.current.y) * ease;

      const { x: mx, y: my } = mouseRef.current;
      const dots = dotsRef.current;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];

        const dx = dot.baseX - mx;
        const dy = dot.baseY - my;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Calcular distancia al centro de la pantalla para el degradado
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const dxCenter = dot.baseX - centerX;
        const dyCenter = dot.baseY - centerY;
        const distToCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
        const maxDistFromCenter = Math.sqrt(centerX * centerX + centerY * centerY);
        const centerFade = Math.max(0, (distToCenter - maxDistFromCenter * 0.35) / (maxDistFromCenter * 0.4));

        if (dist < INFLUENCE_RADIUS) {
          const normalizedDist = dist / INFLUENCE_RADIUS;
          const force = Math.pow(1 - normalizedDist, 2.5) * PUSH_STRENGTH;
          const angle = Math.atan2(dy, dx);
          dot.x = dot.baseX + Math.cos(angle) * force;
          dot.y = dot.baseY + Math.sin(angle) * force;
          
          // Combinar transparencia del mouse con degradado del centro
          const mouseOpacity = 0.03 + normalizedDist * 0.22;
          const finalOpacity = mouseOpacity * centerFade;
          
          if (finalOpacity > 0.01) {
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity})`;
            ctx.fill();
          }
        } else {
          dot.x += (dot.baseX - dot.x) * 0.05;
          dot.y += (dot.baseY - dot.y) * 0.05;
          
          // Aplicar degradado del centro
          const baseOpacity = 0.22 * centerFade;
          
          if (baseOpacity > 0.01) {
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 1, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${baseOpacity})`;
            ctx.fill();
          }
        }
      }

      // Solo dibujar cursor custom si NO está sobre elemento interactivo
      if (mx > -100 && my > -100 && !isOverInteractiveRef.current) {
        const color = "rgba(255, 255, 255, 0.85)";
        const size = 16;
        const innerGap = 4;
        const cornerLength = 6;

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineCap = "square";

        // Esquinas bracket
        ctx.beginPath();
        ctx.moveTo(mx - size, my - size + cornerLength);
        ctx.lineTo(mx - size, my - size);
        ctx.lineTo(mx - size + cornerLength, my - size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mx + size - cornerLength, my - size);
        ctx.lineTo(mx + size, my - size);
        ctx.lineTo(mx + size, my - size + cornerLength);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mx - size, my + size - cornerLength);
        ctx.lineTo(mx - size, my + size);
        ctx.lineTo(mx - size + cornerLength, my + size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mx + size - cornerLength, my + size);
        ctx.lineTo(mx + size, my + size);
        ctx.lineTo(mx + size, my + size - cornerLength);
        ctx.stroke();

        // Cruz central
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(mx, my - size + 5);
        ctx.lineTo(mx, my - innerGap);
        ctx.moveTo(mx, my + innerGap);
        ctx.lineTo(mx, my + size - 5);
        ctx.moveTo(mx - size + 5, my);
        ctx.lineTo(mx - innerGap, my);
        ctx.moveTo(mx + innerGap, my);
        ctx.lineTo(mx + size - 5, my);
        ctx.stroke();

        // Punto central
        ctx.beginPath();
        ctx.arc(mx, my, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      document.body.style.cursor = 'auto';
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function splitToArray(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function safeSemester(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ============================================================================
// TYPEWRITER COMPONENT
// ============================================================================

interface TypewriterProps {
  text: string;
  delay?: number;
  className?: string;
}

function Typewriter({ text, delay = 50, className = "" }: TypewriterProps) {
  const [displayText, setDisplayText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, delay]);

  return (
    <span className={className}>
      {displayText}
      {currentIndex < text.length && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          className="inline-block w-[2px] h-[1em] bg-current ml-[2px] align-middle"
        />
      )}
    </span>
  );
}

// ============================================================================
// ONBOARDING PROGRESS COMPONENT
// ============================================================================

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  return (
    <div className="onbProgress">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <motion.div
            key={index}
            className="onbProgressItem"
            initial={false}
            animate={{ scale: isActive ? 1 : 0.92 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {isActive ? (
              <motion.div
                className="onbProgressActive"
                initial={{ width: 6 }}
                animate={{ width: 20 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            ) : (
              <div
                className={`onbProgressDot ${isCompleted ? "isCompleted" : ""}`}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ============================================================================
// ONBOARDING LAYOUT COMPONENT
// ============================================================================

interface OnboardingLayoutProps {
  children: ReactNode;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onSkip?: () => void;
  showBack?: boolean;
  showSkip?: boolean;
  fromLogin?: boolean;
}

function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  onSkip,
  showBack = true,
  showSkip = true,
  fromLogin = false,
}: OnboardingLayoutProps) {
  return (
    <motion.div 
      className="onboarding-scope min-h-screen w-full flex flex-col"
      initial={fromLogin ? { opacity: 0 } : { opacity: 1 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: fromLogin ? 0.1 : 0 }}
    >
      <ParticleGrid />
      <div className="onboarding-frame">
        <header className="onbHeader">
          <div className="onbNav">
            {showBack && currentStep > 0 ? (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onBack}
                className="text-sm font-medium text-onboarding-text-secondary hover:text-onboarding-text-primary transition-colors"
              >
                Back
              </motion.button>
            ) : (
              <span className="onbNavSpacer" />
            )}

            {showSkip && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onSkip}
                className="text-sm font-medium text-onboarding-text-secondary hover:text-onboarding-text-primary transition-colors"
              >
                Next
              </motion.button>
            )}
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: fromLogin && currentStep === 0 ? 0.3 : 0 }}
              className="w-full max-w-2xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <footer className="onbFooter">
          <OnboardingProgress currentStep={currentStep} totalSteps={totalSteps} />
          <div className="onbByline">by Cyclicall</div>
        </footer>
      </div>
    </motion.div>
  );
}

// ============================================================================
// ONBOARDING INPUT COMPONENT
// ============================================================================

interface OnboardingInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

const OnboardingInput = forwardRef<HTMLInputElement, OnboardingInputProps>(
  ({ label, className = "", ...props }, ref) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full"
      >
        {label && (
          <label className="block text-xs font-medium text-onboarding-text-secondary mb-2 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 rounded-xl
            bg-onboarding-card border border-onboarding-border
            text-onboarding-text-primary placeholder:text-onboarding-text-muted
            outline-none transition-all duration-300
            focus:border-onboarding-border-selected focus:ring-1 focus:ring-onboarding-border-selected
            ${className}
          `}
          {...props}
        />
      </motion.div>
    );
  }
);

OnboardingInput.displayName = "OnboardingInput";

// ============================================================================
// ONBOARDING BUTTON COMPONENT
// ============================================================================

interface OnboardingButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}

function OnboardingButton({
  children,
  variant = "primary",
  loading,
  disabled,
  className = "",
  onClick,
  type = "button",
}: OnboardingButtonProps) {
  const isPrimary = variant === "primary";

  return (
    <motion.button
      type={type}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        px-8 py-3 rounded-xl font-medium text-sm transition-all duration-300
        disabled:opacity-50 disabled:cursor-not-allowed
        ${
          isPrimary
            ? "bg-onboarding-text-primary text-onboarding-bg hover:opacity-90"
            : "bg-onboarding-card border border-onboarding-border text-[rgba(198, 198, 198, 0.92)] hover:opacity-90 "
        }
        ${className}
      `}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <motion.span
            className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          Saving...
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

// ============================================================================
// ONBOARDING CARD COMPONENT
// ============================================================================

interface OnboardingCardProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

function OnboardingCard({
  icon,
  title,
  description,
  selected,
  onClick,
  children,
}: OnboardingCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        relative w-full text-left p-5 rounded-xl border transition-all duration-300
        ${
          selected
            ? "bg-onboarding-card-selected border-onboarding-border-selected"
            : "bg-onboarding-card border-onboarding-border hover:bg-onboarding-card-hover hover:border-onboarding-text-muted"
        }
      `}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-4 right-4 w-5 h-5 rounded-full bg-onboarding-text-primary flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-onboarding-bg" strokeWidth={3} />
        </motion.div>
      )}

      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-onboarding-accent/20 flex items-center justify-center text-onboarding-accent">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-onboarding-text-primary mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-onboarding-text-secondary">
              {description}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </motion.button>
  );
}

// ============================================================================
// STEP 1: NAME (with live name update)
// ============================================================================

interface StepNameProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  email?: string;
}

function StepName({ value, onChange, onNext, email }: StepNameProps) {
  const [showTypewriter, setShowTypewriter] = useState(true);
  const defaultName = email?.split("@")[0] || "there";
  
  // Nombre a mostrar: si escribió algo, usar eso; si no, usar el email o "there"
  const displayName = value.trim().split(" ")[0] || defaultName;
  const canContinue = value.trim().length >= 2;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue) onNext();
  };

  // Cuando empiece a escribir, desactivar typewriter
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (showTypewriter) setShowTypewriter(false);
    onChange(e.target.value);
  };

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <p className="text-xs uppercase tracking-[0.3em] text-onboarding-text-muted mb-4">
          · INITIAL SETUP
        </p>

        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          {showTypewriter && !value.trim() ? (
            <Typewriter text={`Welcome, ${defaultName}`} delay={60} />
          ) : (
            <motion.span
              key={displayName}
              initial={{ opacity: 0.5 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              Welcome, {displayName}
            </motion.span>
          )}
        </h1>

        <p className="text-base text-onboarding-text-secondary max-w-sm mx-auto leading-relaxed text-pretty">
          <span className="block">Enter the name you'd like us to call you</span>
          <span className="block">to personalize your profile.</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm mx-auto space-y-6"
      >
        <OnboardingInput
          type="text"
          placeholder="Your full name"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <OnboardingButton onClick={onNext} disabled={!canContinue} className="w-full">
          Continue
        </OnboardingButton>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 2: CAREER
// ============================================================================

interface StepCareerProps {
  career: string;
  semester: string;
  onCareerChange: (value: string) => void;
  onSemesterChange: (value: string) => void;
  onNext: () => void;
}

function StepCareer({
  career,
  semester,
  onCareerChange,
  onSemesterChange,
  onNext,
}: StepCareerProps) {
  const canContinue = career.trim().length >= 2;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue) onNext();
  };

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          What do you study?
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          This helps us personalize recommendations and connect you with relevant projects.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm mx-auto space-y-4"
      >
        <OnboardingInput
          label="Major / Career"
          type="text"
          placeholder="e.g. Computer Science, Engineering..."
          value={career}
          onChange={(e) => onCareerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <OnboardingInput
          label="Semester (optional)"
          type="number"
          placeholder="e.g. 3"
          min={1}
          max={12}
          inputMode="numeric"
          value={semester}
          onChange={(e) => {
            const raw = e.target.value;
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            const clamped = Math.max(1, Math.min(12, n));
            onSemesterChange(String(clamped));
          }}
        />

        <OnboardingButton onClick={onNext} disabled={!canContinue} className="w-full mt-6">
          Continue
        </OnboardingButton>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 3: SKILLS
// ============================================================================

interface StepSkillsProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
}

function StepSkills({ value, onChange, onNext }: StepSkillsProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onNext();
  };

  const suggestedSkills = [
    "Python",
    "Arduino",
    "SolidWorks",
    "MATLAB",
    "React",
    "Machine Learning",
  ];

  const addSkill = (skill: string) => {
    const current = value.trim();
    if (current.toLowerCase().includes(skill.toLowerCase())) return;
    onChange(current ? `${current}, ${skill}` : skill);
  };

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          What are your skills?
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Tell us what you're good at. This is optional but helps form better teams.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm mx-auto space-y-4"
      >
        <OnboardingInput
          type="text"
          placeholder="Python, Arduino, SolidWorks..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <div className="flex flex-wrap justify-center gap-2">
          {suggestedSkills.map((skill) => (
            <motion.button
              key={skill}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => addSkill(skill)}
              className="px-3 py-1.5 text-xs rounded-full bg-onboarding-card border border-onboarding-border text-onboarding-text-secondary hover:bg-onboarding-card-hover hover:text-onboarding-text-primary transition-colors"
            >
              + {skill}
            </motion.button>
          ))}
        </div>

        <OnboardingButton onClick={onNext} className="w-full mt-6">
          Continue
        </OnboardingButton>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 4: GOALS
// ============================================================================

interface StepGoalsProps {
  goals: string;
  interests: string;
  onGoalsChange: (value: string) => void;
  onInterestsChange: (value: string) => void;
  onNext: () => void;
}

function StepGoals({
  goals,
  interests,
  onGoalsChange,
  onInterestsChange,
  onNext,
}: StepGoalsProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") onNext();
  };

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          Goals & Interests
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          What do you want to achieve? What topics are you passionate about?
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm mx-auto space-y-4"
      >
        <OnboardingInput
          label="Goals"
          type="text"
          placeholder="Learn ML, improve control systems, etc."
          value={goals}
          onChange={(e) => onGoalsChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <OnboardingInput
          label="Interests"
          type="text"
          placeholder="Robotics, Bioinstrumentation, XR..."
          value={interests}
          onChange={(e) => onInterestsChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <OnboardingButton onClick={onNext} className="w-full mt-6">
          Continue
        </OnboardingButton>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 5: LEARNING STYLE
// ============================================================================

const learningOptions = [
  {
    key: "prefersTheory" as const,
    label: "Theory",
    description: "Deep conceptual explanations",
    icon: BookOpen,
  },
  {
    key: "prefersVisual" as const,
    label: "Visual",
    description: "Diagrams, videos and images",
    icon: Eye,
  },
  {
    key: "prefersExamples" as const,
    label: "Examples",
    description: "Step-by-step solved problems",
    icon: FileText,
  },
  {
    key: "prefersPractice" as const,
    label: "Practice",
    description: "Hands-on exercises and projects",
    icon: Wrench,
  },
  {
    key: "prefersStepByStep" as const,
    label: "Step by step",
    description: "Detailed and structured guides",
    icon: ListOrdered,
  },
];

interface StepLearningProps {
  style: LearningStyle;
  onChange: (style: LearningStyle) => void;
  onNext: () => void;
}

function StepLearning({ style, onChange, onNext }: StepLearningProps) {
  const toggle = (key: keyof LearningStyle) => {
    onChange({ ...style, [key]: !style[key] });
  };

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          How do you prefer to learn?
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Select everything that describes you. You can choose multiple options.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-lg mx-auto"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {learningOptions.map(({ key, label, description, icon: Icon }, index) => {
            const isSelected = style[key];

            return (
              <motion.button
                key={key}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggle(key)}
                className={`
                  relative p-4 rounded-xl border text-left transition-all duration-300
                  ${
                    isSelected
                      ? "bg-onboarding-card-selected border-onboarding-border-selected"
                      : "bg-onboarding-card border-onboarding-border hover:bg-onboarding-card-hover"
                  }
                `}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-3 right-3 w-5 h-5 rounded-full bg-onboarding-text-primary flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-onboarding-bg" strokeWidth={3} />
                  </motion.div>
                )}
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-onboarding-text-secondary mt-0.5" />
                  <div>
                    <h3 className="font-medium text-onboarding-text-primary">{label}</h3>
                    <p className="text-xs text-onboarding-text-muted mt-0.5">
                      {description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <OnboardingButton onClick={onNext} className="w-full max-w-sm mx-auto block">
          Continue
        </OnboardingButton>
      </motion.div>
    </div>
  );
}

// ============================================================================
// STEP 6: WORKSPACE
// ============================================================================

interface StepWorkspaceProps {
  mode: WorkspaceMode;
  joinCode: string;
  newLabName: string;
  onModeChange: (mode: WorkspaceMode) => void;
  onJoinCodeChange: (value: string) => void;
  onNewLabNameChange: (value: string) => void;
  onSubmit: () => void;
  saving: boolean;
  error: string | null;
}

function StepWorkspace({
  mode,
  joinCode,
  newLabName,
  onModeChange,
  onJoinCodeChange,
  onNewLabNameChange,
  onSubmit,
  saving,
  error,
}: StepWorkspaceProps) {
  const canContinue =
    (mode === "join" && joinCode.trim().length >= 4) ||
    (mode === "create" && newLabName.trim().length >= 2);

  return (
    <div className="text-center">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          Your Laboratory
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Join an existing laboratory or create a new one.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-xl mx-auto"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <OnboardingCard
            icon={<Users className="w-5 h-5" />}
            title="Join existing"
            description="Enter the laboratory code."
            selected={mode === "join"}
            onClick={() => onModeChange("join")}
          >
            {mode === "join" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3"
              >
                <input
                  type="text"
                  placeholder="Laboratory code"
                  value={joinCode}
                  onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 rounded-lg bg-onboarding-bg border border-onboarding-border text-sm text-onboarding-text-primary placeholder:text-onboarding-text-muted outline-none focus:border-onboarding-border-selected"
                />
                <p className="text-[10px] text-onboarding-text-muted mt-2">
                  You'll join as <span className="font-semibold">Lab Researcher</span>
                </p>
              </motion.div>
            )}
          </OnboardingCard>

          <OnboardingCard
            icon={<Plus className="w-5 h-5" />}
            title="Create new lab"
            description="You'll be the team administrator."
            selected={mode === "create"}
            onClick={() => onModeChange("create")}
          >
            {mode === "create" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3"
              >
                <input
                  type="text"
                  placeholder="Laboratory name"
                  value={newLabName}
                  onChange={(e) => onNewLabNameChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 rounded-lg bg-onboarding-bg border border-onboarding-border text-sm text-onboarding-text-primary placeholder:text-onboarding-text-muted outline-none focus:border-onboarding-border-selected"
                />
                <p className="text-[10px] text-onboarding-text-muted mt-2">
                  You'll be <span className="font-semibold">Admin</span> of this team
                </p>
              </motion.div>
            )}
          </OnboardingCard>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm text-destructive mb-4"
          >
            {error}
          </motion.p>
        )}

        <OnboardingButton
          onClick={onSubmit}
          disabled={!canContinue}
          loading={saving}
          className="w-full max-w-sm mx-auto block"
        >
          Save and continue
        </OnboardingButton>
      </motion.div>
    </div>
  );
}

// ============================================================================
// MAIN ONBOARDING PAGE
// ============================================================================

const TOTAL_STEPS = 6;

export default function Onboarding() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const fromLogin = location.state?.fromLogin === true;

  if (!user) return <Navigate to="/" replace />;

  const [currentStep, setCurrentStep] = useState(0);

  const [fullName, setFullName] = useState("");
  const [career, setCareer] = useState("");
  const [semester, setSemester] = useState("");

  const [skills, setSkills] = useState("");
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState("");

  const [learningStyle, setLearningStyle] = useState<LearningStyle>({
    prefersTheory: false,
    prefersVisual: false,
    prefersExamples: false,
    prefersPractice: false,
    prefersStepByStep: false,
  });

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("create");
  const [joinCode, setJoinCode] = useState("");
  const [newLabName, setNewLabName] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goNext = () => {
    if (currentStep < TOTAL_STEPS - 1) setCurrentStep((prev) => prev + 1);
  };

  const goBack = () => {
    if (currentStep > 0) setCurrentStep((prev) => prev - 1);
  };

  const handleSkip = () => {
    if (currentStep < TOTAL_STEPS - 1) goNext();
    else navigate("/dashboard");
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);

    const currentUser = user;
    if (!currentUser) {
      setError("Your session is not available. Please sign in again.");
      setSaving(false);
      return;
    }

    try {
      const profilePayload = {
        auth_user_id: currentUser.id,
        email: currentUser.email ?? null,
        full_name: fullName.trim(),
        career: career.trim(),
        semester: safeSemester(semester),
        skills: splitToArray(skills),
        goals: splitToArray(goals),
        interests: splitToArray(interests),
        learning_style: {
          notes: null,
          prefers_theory: learningStyle.prefersTheory,
          prefers_visual: learningStyle.prefersVisual,
          prefers_examples: learningStyle.prefersExamples,
          prefers_practice: learningStyle.prefersPractice,
          prefers_step_by_step: learningStyle.prefersStepByStep,
        },
        last_seen: new Date().toISOString(),
        onboarding_completed: true,
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "auth_user_id" });

      if (profileError) {
        console.error("Error upsert profiles:", profileError);
        setError("Could not save your profile information.");
        return;
      }

      let teamId: string;
      let role: TeamRole = "lab_researcher";

      if (workspaceMode === "create") {
        const name = newLabName.trim();
        if (!name) {
          setError("Please enter a name for the laboratory.");
          return;
        }

        const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();

        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .insert({
            name,
            join_code,
            created_by: currentUser.id,
          })
          .select("id")
          .single();

        if (teamError || !teamData) {
          console.error("Error creating team:", teamError);
          setError("Could not create the laboratory.");
          return;
        }

        teamId = teamData.id;
        role = "admin";
      } else {
        const code = joinCode.trim().toUpperCase();
        if (!code) {
          setError("Please enter the code of the laboratory you want to join.");
          return;
        }

        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("id")
          .eq("join_code", code)
          .maybeSingle();

        if (teamError || !teamData) {
          console.error("Error finding team:", teamError);
          setError("We couldn't find a laboratory with that code.");
          return;
        }

        teamId = teamData.id;
        role = "lab_researcher";
      }

      const { error: membershipError } = await supabase
        .from("team_memberships")
        .upsert(
          {
            team_id: teamId,
            auth_user_id: currentUser.id,
            role,
          },
          { onConflict: "team_id,auth_user_id" }
        );

      if (membershipError) {
        console.error("Error upsert team_memberships:", membershipError);
        setError("Could not link your laboratory.");
        return;
      }

      const { error: activeError } = await supabase
        .from("profiles")
        .update({ active_team_id: teamId })
        .eq("auth_user_id", currentUser.id);

      if (activeError) {
        console.error("Error saving active_team_id:", activeError);
        setError("Could not save your active laboratory.");
        return;
      }

      navigate("/dashboard");
    } catch (e) {
      console.error(e);
      setError("There was an error saving. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <StepName
            value={fullName}
            onChange={setFullName}
            onNext={goNext}
            email={user?.email}
          />
        );
      case 1:
        return (
          <StepCareer
            career={career}
            semester={semester}
            onCareerChange={setCareer}
            onSemesterChange={setSemester}
            onNext={goNext}
          />
        );
      case 2:
        return <StepSkills value={skills} onChange={setSkills} onNext={goNext} />;
      case 3:
        return (
          <StepGoals
            goals={goals}
            interests={interests}
            onGoalsChange={setGoals}
            onInterestsChange={setInterests}
            onNext={goNext}
          />
        );
      case 4:
        return (
          <StepLearning
            style={learningStyle}
            onChange={setLearningStyle}
            onNext={goNext}
          />
        );
      case 5:
        return (
          <StepWorkspace
            mode={workspaceMode}
            joinCode={joinCode}
            newLabName={newLabName}
            onModeChange={setWorkspaceMode}
            onJoinCodeChange={setJoinCode}
            onNewLabNameChange={setNewLabName}
            onSubmit={handleSubmit}
            saving={saving}
            error={error}
          />
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingLayout
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      onBack={goBack}
      onSkip={handleSkip}
      showBack={currentStep > 0}
      showSkip={currentStep < TOTAL_STEPS - 1}
      fromLogin={fromLogin}
    >
      {renderStep()}
    </OnboardingLayout>
  );
}