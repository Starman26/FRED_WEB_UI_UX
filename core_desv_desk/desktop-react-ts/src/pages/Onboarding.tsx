import {
  useState,
  InputHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";
import { Navigate, useNavigate } from "react-router-dom";
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

// Roles (en team_memberships.role)
type TeamRole = "admin" | "lab_researcher";

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
                initial={{ width: 8 }}
                animate={{ width: 24 }}
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
}

function OnboardingLayout({
  children,
  currentStep,
  totalSteps,
  onBack,
  onSkip,
  showBack = true,
  showSkip = true,
}: OnboardingLayoutProps) {
  return (
    <div className="onboarding-scope min-h-screen w-full bg-onboarding-bg flex flex-col">
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
              Skip
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
            transition={{ duration: 0.4, ease: "easeOut" }}
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
          Guardando...
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
// STEP 1: NAME
// ============================================================================

interface StepNameProps {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  email?: string;
}

function StepName({ value, onChange, onNext, email }: StepNameProps) {
  const firstName =
    value.trim().split(" ")[0] || email?.split("@")[0] || "traveler";
  const canContinue = value.trim().length >= 2;

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
        <p className="text-xs uppercase tracking-[0.3em] text-onboarding-text-muted mb-4">
          · CONFIGURACIÓN INICIAL
        </p>

        <h1 className="text-3xl md:text-4xl font-semibold text-onboarding-text-primary mb-3">
          Bienvenido, {firstName}
        </h1>

        <p className="text-base text-onboarding-text-secondary max-w-sm mx-auto leading-relaxed text-pretty">
          <span className="block">Ingresa con qué nombre prefieres que te llamen</span>
          <span className="block">para personalizar tu perfil.</span>
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
          placeholder="Tu nombre completo"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <OnboardingButton onClick={onNext} disabled={!canContinue} className="w-full">
          Continuar
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
          ¿Qué estudias?
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Esto nos ayuda a personalizar recomendaciones y conectarte con proyectos relevantes.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm mx-auto space-y-4"
      >
        <OnboardingInput
          label="Carrera / Major"
          type="text"
          placeholder="IBT, IMT, IM, etc."
          value={career}
          onChange={(e) => onCareerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <OnboardingInput
          label="Semestre (opcional)"
          type="number"
          placeholder="Ej. 3"
          min={1}
          max={8}
          inputMode="numeric"
          value={semester}
          onChange={(e) => {
            const raw = e.target.value;
            const n = Number(raw);
            if (!Number.isFinite(n)) return;
            const clamped = Math.max(1, Math.min(8, n));
            onSemesterChange(String(clamped));
          }}
        />

        <OnboardingButton onClick={onNext} disabled={!canContinue} className="w-full mt-6">
          Continuar
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
          ¿Cuáles son tus skills?
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Cuéntanos en qué eres bueno. Esto es opcional pero ayuda a formar mejores equipos.
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
          Continuar
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
          Metas e intereses
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          ¿Qué quieres lograr? ¿Qué temas te apasionan?
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="max-w-sm mx-auto space-y-4"
      >
        <OnboardingInput
          label="Metas"
          type="text"
          placeholder="Aprender ML, mejorar en control, etc."
          value={goals}
          onChange={(e) => onGoalsChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <OnboardingInput
          label="Intereses"
          type="text"
          placeholder="Robótica, Bioinstrumentación, XR..."
          value={interests}
          onChange={(e) => onInterestsChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <OnboardingButton onClick={onNext} className="w-full mt-6">
          Continuar
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
    label: "Teoría",
    description: "Explicaciones conceptuales profundas",
    icon: BookOpen,
  },
  {
    key: "prefersVisual" as const,
    label: "Visual",
    description: "Diagramas, videos e imágenes",
    icon: Eye,
  },
  {
    key: "prefersExamples" as const,
    label: "Ejemplos",
    description: "Problemas resueltos paso a paso",
    icon: FileText,
  },
  {
    key: "prefersPractice" as const,
    label: "Práctica",
    description: "Ejercicios y proyectos hands-on",
    icon: Wrench,
  },
  {
    key: "prefersStepByStep" as const,
    label: "Paso a paso",
    description: "Guías detalladas y estructuradas",
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
          ¿Cómo prefieres aprender?
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Selecciona todo lo que te describa. Puedes elegir varias opciones.
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
          Continuar
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
          Tu laboratorio
        </h1>
        <p className="text-base text-onboarding-text-secondary max-w-md mx-auto">
          Únete a un laboratorio existente o crea uno nuevo.
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
            title="Unirme a uno existente"
            description="Ingresa el código del laboratorio."
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
                  placeholder="Código de laboratorio"
                  value={joinCode}
                  onChange={(e) => onJoinCodeChange(e.target.value.toUpperCase())}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 rounded-lg bg-onboarding-bg border border-onboarding-border text-sm text-onboarding-text-primary placeholder:text-onboarding-text-muted outline-none focus:border-onboarding-border-selected"
                />
                <p className="text-[10px] text-onboarding-text-muted mt-2">
                  Te unirás como <span className="font-semibold">Lab Researcher</span>
                </p>
              </motion.div>
            )}
          </OnboardingCard>

          <OnboardingCard
            icon={<Plus className="w-5 h-5" />}
            title="Crear laboratorio nuevo"
            description="Serás Administrador de equipos."
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
                  placeholder="Nombre del laboratorio"
                  value={newLabName}
                  onChange={(e) => onNewLabNameChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 rounded-lg bg-onboarding-bg border border-onboarding-border text-sm text-onboarding-text-primary placeholder:text-onboarding-text-muted outline-none focus:border-onboarding-border-selected"
                />
                <p className="text-[10px] text-onboarding-text-muted mt-2">
                  Serás <span className="font-semibold">Admin</span> de este equipo
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
          Guardar y continuar
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
  const { user } = useAuth();

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
      setError("Tu sesión no está disponible. Inicia sesión de nuevo.");
      setSaving(false);
      return;
    }

    try {
      // =========================================================
      // 1) PROFILES: upsert + onboarding_completed = true
      // =========================================================
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
        setError("No se pudo guardar tu información de perfil.");
        return;
      }

      // =========================================================
      // 2) TEAMS: create/join
      //    - usa join_code (si tu tabla usa 'code', cambia join_code -> code)
      // =========================================================
      let teamId: string;
      let role: TeamRole = "lab_researcher";

      if (workspaceMode === "create") {
        const name = newLabName.trim();
        if (!name) {
          setError("Escribe un nombre para el laboratorio.");
          return;
        }

        const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();

        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .insert({
            name,
            join_code, // <-- si tu columna se llama "code", cambia a: code: join_code
            created_by: currentUser.id,
          })
          .select("id")
          .single();

        if (teamError || !teamData) {
          console.error("Error creando team:", teamError);
          setError("No se pudo crear el laboratorio.");
          return;
        }

        teamId = teamData.id;
        role = "admin";
      } else {
        const code = joinCode.trim().toUpperCase();
        if (!code) {
          setError("Escribe el código del laboratorio al que quieres unirte.");
          return;
        }

        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("id")
          .eq("join_code", code) // <-- si tu columna se llama "code", cambia a .eq("code", code)
          .maybeSingle();

        if (teamError || !teamData) {
          console.error("Error buscando team:", teamError);
          setError("No encontramos un laboratorio con ese código.");
          return;
        }

        teamId = teamData.id;
        role = "lab_researcher";
      }

      // =========================================================
      // 3) MEMBERSHIP: upsert (permite estar en muchos teams con roles distintos)
      // =========================================================
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
        setError("No se pudo vincular tu laboratorio.");
        return;
      }

      // =========================================================
      // 4) ACTIVE TEAM: profiles.active_team_id = teamId (solo 1 activo)
      // =========================================================
      const { error: activeError } = await supabase
        .from("profiles")
        .update({ active_team_id: teamId })
        .eq("auth_user_id", currentUser.id);

      if (activeError) {
        console.error("Error guardando active_team_id:", activeError);
        setError("No se pudo guardar tu laboratorio activo.");
        return;
      }

      navigate("/dashboard");
    } catch (e) {
      console.error(e);
      setError("Hubo un error al guardar. Intenta de nuevo.");
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
    >
      {renderStep()}
    </OnboardingLayout>
  );
}
