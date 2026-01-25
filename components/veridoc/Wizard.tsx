"use client";

import { useEffect, useReducer } from "react";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";
import { PrivacyBadge } from "@/components/veridoc/PrivacyBadge";
import { StepDiagnosis } from "@/components/veridoc/StepDiagnosis";
import { StepResults } from "@/components/veridoc/StepResults";
import { StepUploadLabs } from "@/components/veridoc/StepUploadLabs";
import { clearPendingLabsFile } from "@/lib/veridoc/sessionStore";

 type Step = 1 | 2 | 3;

 type WizardState = {
   step: Step;
   labsFile: File | null;
   diagnosisMode: DiagnosisMode;
   diagnosisFile: File | null;
   diagnosisText: string;
 };

 type WizardAction =
   | { type: "setStep"; step: Step }
   | { type: "setLabsFile"; file: File | null }
   | { type: "setDiagnosisMode"; mode: DiagnosisMode }
   | { type: "setDiagnosisFile"; file: File | null }
   | { type: "setDiagnosisText"; text: string }
   | { type: "clearSession" };

 const initialState: WizardState = {
   step: 1,
   labsFile: null,
   diagnosisMode: "none",
   diagnosisFile: null,
   diagnosisText: "",
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
         diagnosisFile: action.mode === "file" ? state.diagnosisFile : null,
         diagnosisText: action.mode === "text" ? state.diagnosisText : "",
       };
     case "setDiagnosisFile":
       return { ...state, diagnosisFile: action.file };
     case "setDiagnosisText":
       return { ...state, diagnosisText: action.text };
     case "clearSession":
       return { ...initialState };
     default:
       return state;
   }
 };

 const MAX_FILE_BYTES = 25 * 1024 * 1024;

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

  const steps = [
    { id: 1, label: "Upload your labs" },
    { id: 2, label: "Diagnosis (optional)" },
    { id: 3, label: "Recommendation" },
  ];

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

  return (
    <div className="relative">
      <div className="sticky top-0 z-30 border-b border-white/70 bg-[#f5fbfb]/95 backdrop-blur sm:static sm:border-transparent">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            {canGoBack ? (
              <button
                type="button"
                onClick={handleBack}
                aria-label="Go back to previous step"
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M15 6l-6 6 6 6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : (
              <span className="h-11 w-11" aria-hidden="true" />
            )}
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Veridoc
              </p>
              <p className="text-sm font-semibold text-slate-900">
                Local wizard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <PrivacyBadge />
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M4 7h16M9 7V5h6v2m-8 4v6m4-6v6m4-6v6M6 7l1 13h10l1-13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Clear session
            </button>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pb-3 text-xs sm:hidden">
          <span className="font-semibold text-slate-900">
            Step {state.step}/3
          </span>
          <PrivacyBadge compact />
        </div>
      </div>

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
                onContinue={() => dispatch({ type: "setStep", step: 2 })}
              />
            ) : null}

            {state.step === 2 ? (
              <StepDiagnosis
                diagnosisMode={state.diagnosisMode}
                diagnosisFile={state.diagnosisFile}
                diagnosisText={state.diagnosisText}
                maxBytes={MAX_FILE_BYTES}
                formatBytes={formatBytes}
                onModeChange={(mode) =>
                  dispatch({ type: "setDiagnosisMode", mode })
                }
                onFileSelect={(file) =>
                  dispatch({ type: "setDiagnosisFile", file })
                }
                onClearFile={() =>
                  dispatch({ type: "setDiagnosisFile", file: null })
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
                diagnosisFile={state.diagnosisFile}
                diagnosisText={state.diagnosisText}
                formatBytes={formatBytes}
                onBack={() => dispatch({ type: "setStep", step: 2 })}
                onStartOver={handleClear}
                onClearSession={handleClear}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
