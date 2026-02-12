"use client";

import { useEffect, useReducer } from "react";
import { useTranslations } from "next-intl";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";
import type { SavedReport } from "@/lib/veridoc/analysesStore";
import { addAnalysis } from "@/lib/veridoc/analysesStore";
import { addAnalysisIDB } from "@/lib/veridoc/idbStore";
import { uploadToCloudinary } from "@/lib/cloudinary";
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
  isUploading: boolean;
  extractedMarkdown: string | null;
};

type WizardAction =
  | { type: "setStep"; step: Step }
  | { type: "setLabsFile"; file: File | null }
  | { type: "setDiagnosisMode"; mode: DiagnosisMode }
  | { type: "setDiagnosisText"; text: string }
  | { type: "setLastSavedAnalysisId"; id: string | null }
  | { type: "setUploading"; isUploading: boolean }
  | { type: "setExtractedMarkdown"; markdown: string | null }
  | { type: "clearSession" };

const initialState: WizardState = {
  step: 1,
  labsFile: null,
  diagnosisMode: "none",
  diagnosisText: "",
  lastSavedAnalysisId: null,
  isUploading: false,
  extractedMarkdown: null,
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
    case "setUploading":
      return { ...state, isUploading: action.isUploading };
    case "setExtractedMarkdown":
      return { ...state, extractedMarkdown: action.markdown };
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

  const t = useTranslations("wizard");
  const tCommon = useTranslations("common");
  const steps = [
    { id: 1, label: t("step1") },
    { id: 2, label: t("step2") },
    { id: 3, label: t("step3") },
    { id: 4, label: t("step4") },
  ];

  const handleRequestSecondOpinion = async (report: SavedReport) => {
    if (!state.labsFile) return;

    dispatch({ type: "setUploading", isUploading: true });
    let pdfUrl: string | undefined;

    try {
      // Sube a Cloudinary antes de guardar
      const uint8 = new Uint8Array(await state.labsFile.arrayBuffer());
      const uploadedUrl = await uploadToCloudinary(
        uint8,
        state.labsFile.name,
        state.labsFile.type || "application/pdf"
      );
      if (uploadedUrl) pdfUrl = uploadedUrl;
    } catch (e) {
      console.warn("Wizard: failed to upload PDF to Cloudinary.", e);
    }

    const analysisData = {
      labFileName: state.labsFile.name,
      pdfUrl,
      report: {
        summary: report.summary,
        keyItems: report.keyItems,
        nextSteps: report.nextSteps,
        questions: report.questions,
        extraInfo: report.extraInfo,
        disclaimer: report.disclaimer,
      },
    };

    // 1. Guardar metadatos en localStorage (para compatibilidad rápida con UI actual)
    const saved = addAnalysis(analysisData);

    // 2. Guardar en IndexedDB (soporta archivos binarios grandes)
    try {
      await addAnalysisIDB({
        ...analysisData,
        id: saved.id,
        createdAt: saved.createdAt,
        pdfFile: state.labsFile,
      });
      console.log("Wizard: Saved to IndexedDB successfully.");
    } catch (err) {
      console.error("Wizard: Failed to save to IndexedDB:", err);
    }

    dispatch({ type: "setUploading", isUploading: false });
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
          aria-label={t("goBack")}
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
          {t("step", { current: `${state.step}/4` })}
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
                  {t("steps")}
                </p>
                <ol className="mt-4 grid gap-3" aria-label={t("steps")}>
                  {steps.map((step) => {
                    const isActive = state.step === step.id;
                    const isComplete = state.step > step.id;
                    return (
                      <li
                        key={step.id}
                        aria-current={isActive ? "step" : undefined}
                        className={`rounded-2xl border px-4 py-3 text-sm transition ${isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : isComplete
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white/80 text-slate-600"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{t("stepXofY", { current: step.id })}</span>
                          {isComplete ? (
                            <span className="text-xs font-semibold">{tCommon("done")}</span>
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
                onAnalysisComplete={(markdown) =>
                  dispatch({ type: "setExtractedMarkdown", markdown })
                }
                onClear={() => {
                  dispatch({ type: "setLabsFile", file: null });
                  dispatch({ type: "setExtractedMarkdown", markdown: null });
                }}
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
                  dispatch({ text, type: "setDiagnosisText" })
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
                isUploading={state.isUploading}
                extractedMarkdown={state.extractedMarkdown ?? undefined}
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