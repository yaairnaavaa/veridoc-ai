"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { jsPDF } from "jspdf";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";
import { generateLocalRecommendation } from "@/lib/veridoc/localInference";
import type { SavedReport } from "@/lib/veridoc/analysesStore";
import { analyzeWithNearAI, type NearReport } from "@/app/actions/analyze-near";

type StepResultsProps = {
  labsFile: File;
  diagnosisMode: DiagnosisMode;
  diagnosisText: string;
  formatBytes: (bytes: number) => string;
  onStartOver: () => void;
  onClearSession: () => void;
  onBack: () => void;
  isUploading?: boolean;
  extractedMarkdown?: string;
  onRequestSecondOpinion?: (report: SavedReport) => void;
};

export const StepResults = ({
  labsFile,
  diagnosisMode,
  diagnosisText,
  formatBytes,
  onStartOver,
  onClearSession,
  onBack,
  isUploading,
  extractedMarkdown,
  onRequestSecondOpinion,
}: StepResultsProps) => {
  const [nearLoading, setNearLoading] = useState(true);
  const [nearResult, setNearResult] = useState<{
    success: boolean;
    report?: NearReport;
    error?: string;
  } | null>(null);

  const locale = useLocale() as "es" | "en";
  const t = useTranslations("stepResults");
  const tCommon = useTranslations("common");
  const diagnosisForAI =
    diagnosisMode === "text" && diagnosisText?.trim() ? diagnosisText.trim() : undefined;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setNearLoading(true);
      setNearResult(null);
      try {
        const response = await analyzeWithNearAI(diagnosisForAI, locale, extractedMarkdown);
        if (!cancelled) setNearResult(response);
      } catch (err: unknown) {
        if (!cancelled) {
          setNearResult({
            success: false,
            error: err instanceof Error ? err.message : t("errorGenerating"),
          });
        }
      } finally {
        if (!cancelled) setNearLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diagnosisForAI, locale]);

  const localReport = useMemo(
    () =>
      generateLocalRecommendation({
        labsFile,
        diagnosisMode,
        diagnosisText,
      }),
    [labsFile, diagnosisMode, diagnosisText],
  );

  type DisplayReport = typeof localReport & { extraInfo?: string };
  const report: DisplayReport = nearResult?.success && nearResult.report
    ? {
      ...localReport,
      summary: nearResult.report.summary,
      keyItems: nearResult.report.keyItems.length > 0 ? nearResult.report.keyItems : localReport.keyItems,
      nextSteps: nearResult.report.nextSteps.length > 0 ? nearResult.report.nextSteps : localReport.nextSteps,
      questions: nearResult.report.questions.length > 0 ? nearResult.report.questions : localReport.questions,
      extraInfo: nearResult.report.extraInfo,
    }
    : localReport;

  const isUsingFallback = !nearLoading && (!nearResult?.success || !nearResult?.report);

  const handleDownload = () => {
    const doc = new jsPDF({ format: "a4", unit: "pt" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginPt = 55;
    const marginLeft = marginPt;
    const marginRight = marginPt;
    const marginTop = marginPt;
    const marginBottom = marginPt;
    const contentWidthPt = pageW - marginLeft - marginRight;
    const maxY = pageH - marginBottom;
    let y = marginTop;
    const lineHeight = 14;
    const fontSize = 11;

    const pushText = (text: string, opts?: { bold?: boolean; size?: number }) => {
      const size = opts?.size ?? fontSize;
      doc.setFontSize(size);
      doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n"), contentWidthPt, { fontSize: size });
      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > maxY) {
          doc.addPage();
          y = marginTop;
        }
        doc.text(lines[i], marginLeft, y);
        y += lineHeight;
      }
    };

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    if (y + lineHeight * 2 > maxY) {
      doc.addPage();
      y = marginTop;
    }
    doc.text("Veridoc AI", marginLeft, y);
    y += lineHeight * 2;

    doc.setFontSize(fontSize);
    doc.setFont("helvetica", "normal");
    pushText(report.summary);
    y += lineHeight;

    pushText("Key items to review:");
    report.keyItems.forEach((item) => pushText(`• ${item}`));
    y += lineHeight;

    pushText("Next steps:");
    report.nextSteps.forEach((item) => pushText(`• ${item}`));
    y += lineHeight;

    pushText("Questions to ask your clinician:");
    report.questions.forEach((item) => pushText(`• ${item}`));
    y += lineHeight;

    if (report.extraInfo) {
      pushText("Additional information:");
      pushText(report.extraInfo);
      y += lineHeight;
    }

    y += lineHeight;
    pushText(report.disclaimer, { bold: true });

    doc.save("veridoc-summary.pdf");
  };

  const diagnosisLabel =
    diagnosisMode === "text" ? t("diagnosisNotes") : t("noDiagnosis");

  return (
    <section className="grid gap-6 pb-24 sm:pb-0">
      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("title")}
          </h2>
          <p className="text-sm text-slate-600">
            {t("subtitle")}
          </p>
        </div>

        <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-slate-500">{t("labFile")}</p>
              <p className="font-semibold text-slate-900">{labsFile.name}</p>
              <p className="text-xs text-slate-500">
                {labsFile.type || t("unknownType")} | {formatBytes(labsFile.size)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">{t("diagnosisInput")}</p>
              <p className="font-semibold text-slate-900">{diagnosisLabel}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          {nearLoading && !nearResult ? (
            <div
              className="flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-6 py-12"
              role="status"
              aria-live="polite"
              aria-label={t("generating")}
            >
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700" />
              <div className="space-y-1 text-center">
                <p className="text-sm font-semibold text-slate-700">
                  {t("preparing")}
                </p>
                <p className="text-xs text-slate-500 max-w-sm">
                  {t("analyzing")}
                </p>
              </div>
              <p className="text-xs text-slate-400">{t("poweredBy")}</p>
            </div>
          ) : null}

          {(nearResult?.success && nearResult.report) || !nearLoading ? (
            <>
              {isUsingFallback ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" role="alert">
                  <p className="font-semibold">{t("fallbackTitle")}</p>
                  <p className="mt-1 text-xs text-amber-700">
                    {t("fallbackHint")}
                  </p>
                  {nearResult && !nearResult.success && nearResult.error ? (
                    <p className="mt-2 text-xs font-medium text-amber-800">Details: {nearResult.error}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
                <h3 className="text-sm font-semibold text-slate-900">{t("summary")}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {report.summary}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("keyItems")}
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
                  {report.keyItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("nextStepsQuestions")}
                </h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t("nextSteps")}
                    </p>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                      {report.nextSteps.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {t("questionsToAsk")}
                    </p>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                      {report.questions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {report.extraInfo ? (
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t("additionalInfo")}
                  </h3>
                  <div className="mt-2 text-sm leading-7 text-slate-600 whitespace-pre-wrap">
                    {report.extraInfo}
                  </div>
                  <p className="mt-3 text-right text-xs text-slate-400">
                    {t("poweredBy")}
                  </p>
                </div>
              ) : null}

              {nearResult?.success && !report.extraInfo ? (
                <p className="text-right text-xs text-slate-400">
                  {t("poweredBy")}
                </p>
              ) : null}
            </>
          ) : null}

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
            {report.disclaimer}
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              {t("sessionActions")}
            </p>
            {onRequestSecondOpinion ? (
              <button
                type="button"
                disabled={isUploading}
                onClick={() =>
                  onRequestSecondOpinion({
                    summary: report.summary,
                    keyItems: report.keyItems,
                    nextSteps: report.nextSteps,
                    questions: report.questions,
                    extraInfo: report.extraInfo,
                    disclaimer: report.disclaimer,
                  })
                }
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-teal-600 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    {tCommon("uploading") || "Enviando..."}
                  </>
                ) : (
                  t("requestSecondOpinion")
                )}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDownload}
              className="mt-3 flex w-full items-center justify-center rounded-full bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              {t("downloadPdf")}
            </button>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onStartOver}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {t("startOver")}
              </button>
              <button
                type="button"
                onClick={onClearSession}
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                {t("clearSession")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/70 bg-[#f5fbfb]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {tCommon("back")}
          </button>
        </div>
      </div>
    </section>
  );
};
