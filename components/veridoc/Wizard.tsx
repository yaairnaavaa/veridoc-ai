"use client";

import { useEffect, useReducer } from "react";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";
import type { SavedReport } from "@/lib/veridoc/analysesStore";
import { addAnalysis } from "@/lib/veridoc/analysesStore";
import { NavBar } from "@/components/NavBar";
import { PrivacyBadge } from "@/components/veridoc/PrivacyBadge";
import { StepDiagnosis } from "@/components/veridoc/StepDiagnosis";
import { StepResults } from "@/components/veridoc/StepResults";
import { StepSecondOpinion } from "@/components/veridoc/StepSecondOpinion";
import { StepUploadLabs } from "@/components/veridoc/StepUploadLabs";
import { clearPendingLabsFile } from "@/lib/veridoc/sessionStore";

type Step = 1 | 2 | 3 | 4;

type WizardState = {
  step: Step;
  labsFile: File | null;
  diagnosisMode: DiagnosisMode;
  diagnosisText: string;
  /** Set when user goes to step 4 (second opinion); used for marketplace link */
  lastSavedAnalysisId: string | null;
};

type WizardAction =
  | { type: "setStep"; step: Step }
  | { type: "setLabsFile"; file: File | null }
  | { type: "setDiagnosisMode"; mode: DiagnosisMode }
  | { type: "setDiagnosisText"; text: string }
  | { type: "setLastSavedAnalysisId"; id: string | null }
  | { type: "clearSession" };

const initialState: WizardState = {
  step: 1,
  labsFile: null,
  diagnosisMode: "none",
  diagnosisText: "",
  lastSavedAnalysisId: null,
};

const reducer = (state: WizardState, action: WizardAction): WizardState => {
  switch (action.type) {
    case "setStep":
      return { ...state, step: action.step };
    case "setLabsFile":
      return { ...state, labsFile: action.file };
    case "setDiagnosisMode":
      return {
        ...state,
        diagnosisMode: action.mode,
        diagnosisText: action.mode === "text" ? state.diagnosisText : "",
      };
    case "setDiagnosisText":
      return { ...state, diagnosisText: action.text };
    case "setLastSavedAnalysisId":
      return { ...state, lastSavedAnalysisId: action.id };
    case "clearSession":
      return { ...initialState };
    default:
      return state;
  }
};

// Límite razonable para análisis en local (sin subir a servidor)
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

type WizardProps = {
  initialLabsFile?: File | null;
};

export const Wizard = ({ initialLabsFile }: WizardProps) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (initialLabsFile) {
      dispatch({ type: "setLabsFile", file: initialLabsFile });
    }
  }, [initialLabsFile]);

  const handleContinueFromLabs = () => {
    if (!state.labsFile) return;
    dispatch({ type: "setStep", step: 2 });
  };

  const steps = [
    { id: 1, label: "Upload your labs (PDF)" },
    { id: 2, label: "Diagnosis (optional)" },
    { id: 3, label: "Recommendation" },
    { id: 4, label: "Second opinion" },
  ];

  const handleRequestSecondOpinion = (report: SavedReport) => {
    if (!state.labsFile) return;
    const saved = addAnalysis({
      labFileName: state.labsFile.name,
      report: {
        summary: report.summary,
        keyItems: report.keyItems,
        nextSteps: report.nextSteps,
        questions: report.questions,
        extraInfo: report.extraInfo,
        disclaimer: report.disclaimer,
      },
    });
    dispatch({ type: "setLastSavedAnalysisId", id: saved.id });
    dispatch({ type: "setStep", step: 4 });
  };

  const canGoBack = state.step > 1;

  const handleBack = () => {
    if (!canGoBack) {
      return;
    }
    dispatch({ type: "setStep", step: (state.step - 1) as Step });
  };

  const handleClear = () => {
    clearPendingLabsFile();
    dispatch({ type: "clearSession" });
  };

  const wizardLeftSlot = (
    <>
      {canGoBack ? (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Go back to previous step"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <span className="h-9 w-9 shrink-0" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-500">
          Veridoc
        </p>
        <p className="text-sm font-semibold text-slate-900">
          Step {state.step}/4
        </p>
      </div>
    </>
  );

  return (
    <div className="relative">
      <NavBar
        leftSlot={wizardLeftSlot}
        variant="wizard"
        onClearSession={handleClear}
      />

      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-10">
        <div className="grid gap-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <aside className="hidden md:block">
            <div className="sticky top-6 space-y-6">
              <div className="rounded-3xl border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Steps
                </p>
                <ol className="mt-4 grid gap-3" aria-label="Steps">
                  {steps.map((step) => {
                    const isActive = state.step === step.id;
                    const isComplete = state.step > step.id;
                    return (
                      <li
                        key={step.id}
                        aria-current={isActive ? "step" : undefined}
                        className={`rounded-2xl border px-4 py-3 text-sm transition ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : isComplete
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white/80 text-slate-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Step {step.id}</span>
                          {isComplete ? (
                            <span className="text-xs font-semibold">Done</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs">{step.label}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <PrivacyBadge />
            </div>
          </aside>

          <div className="mx-auto max-w-md motion-safe:animate-fade-slide motion-reduce:animate-none md:mx-0 md:max-w-none md:px-0">
            {state.step === 1 ? (
              <StepUploadLabs
                labsFile={state.labsFile}
                maxBytes={MAX_FILE_BYTES}
                formatBytes={formatBytes}
                onFileSelect={(file) =>
                  dispatch({ type: "setLabsFile", file })
                }
                onClear={() => dispatch({ type: "setLabsFile", file: null })}
                onContinue={handleContinueFromLabs}
              />
            ) : null}

            {state.step === 2 ? (
              <StepDiagnosis
                diagnosisMode={state.diagnosisMode}
                diagnosisText={state.diagnosisText}
                onModeChange={(mode) =>
                  dispatch({ type: "setDiagnosisMode", mode })
                }
                onTextChange={(text) =>
                  dispatch({ type: "setDiagnosisText", text })
                }
                onBack={() => dispatch({ type: "setStep", step: 1 })}
                onContinue={() => dispatch({ type: "setStep", step: 3 })}
              />
            ) : null}

            {state.step === 3 && state.labsFile ? (
              <StepResults
                labsFile={state.labsFile}
                diagnosisMode={state.diagnosisMode}
                diagnosisText={state.diagnosisText}
                formatBytes={formatBytes}
                onBack={() => dispatch({ type: "setStep", step: 2 })}
                onStartOver={handleClear}
                onClearSession={handleClear}
                onRequestSecondOpinion={handleRequestSecondOpinion}
              />
            ) : null}

            {state.step === 4 ? (
              <StepSecondOpinion
                analysisId={state.lastSavedAnalysisId ?? undefined}
                onBack={() => dispatch({ type: "setStep", step: 3 })}
                onStartOver={handleClear}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};