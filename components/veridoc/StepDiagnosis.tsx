"use client";

import { useEffect, useRef, useState } from "react";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";

type StepDiagnosisProps = {
  diagnosisMode: DiagnosisMode;
  diagnosisText: string;
  onModeChange: (mode: DiagnosisMode) => void;
  onTextChange: (text: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export const StepDiagnosis = ({
  diagnosisMode,
  diagnosisText,
  onModeChange,
  onTextChange,
  onBack,
  onContinue,
}: StepDiagnosisProps) => {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [diagnosisMode]);

  useEffect(() => {
    if (diagnosisMode !== "text") return;
    if (!textAreaRef.current) return;
    textAreaRef.current.style.height = "auto";
    textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
  }, [diagnosisMode, diagnosisText]);

  const handleContinue = () => {
    setError(null);
    onContinue();
  };

  const characterCount = diagnosisText.length;

  return (
    <section className="grid gap-6 pb-24 sm:pb-0">
      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold text-slate-900">
            Diagnosis (optional)
          </h2>
          <p className="text-sm text-slate-600">
            Add written diagnosis notes if you have them. You can also skip this step.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Diagnosis options"
          className="mt-5 grid gap-2 rounded-2xl border border-slate-200/70 bg-white/80 p-2 sm:grid-cols-2 sm:gap-3"
        >
          {[
            { id: "text" as const, label: "Paste diagnosis text" },
            { id: "none" as const, label: "I don't have a diagnosis" },
          ].map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={diagnosisMode === option.id}
              onClick={() => onModeChange(option.id)}
              className={`min-h-[44px] rounded-2xl px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                diagnosisMode === option.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {diagnosisMode === "text" ? (
            <div className="grid gap-3">
              <label
                htmlFor="diagnosis-text"
                className="text-sm font-medium text-slate-700"
              >
                Paste diagnosis notes
              </label>
              <textarea
                id="diagnosis-text"
                value={diagnosisText}
                onChange={(event) => onTextChange(event.target.value)}
                ref={textAreaRef}
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                placeholder="Optional: paste the diagnosis summary or notes."
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Your notes stay in memory and are never stored or uploaded.
                </span>
                <div className="flex items-center gap-3">
                  <span>{characterCount} chars</span>
                  <button
                    type="button"
                    onClick={() => onTextChange("")}
                    className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {diagnosisMode === "none" ? (
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No diagnosis added. We'll generate a summary from the lab report only.
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/70 bg-[#f5fbfb]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Continue
          </button>
        </div>
      </div>
    </section>
  );
};
