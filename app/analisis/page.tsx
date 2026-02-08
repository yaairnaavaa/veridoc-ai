"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getAnalyses,
  removeAnalysis,
  clearAnalyses,
  type SavedAnalysis,
} from "@/lib/veridoc/analysesStore";
import { NavBar } from "@/components/NavBar";
import {
  FileText,
  Trash2,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Inbox,
} from "lucide-react";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnalysisCard({
  analysis,
  onRemove,
}: {
  analysis: SavedAnalysis;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const summaryPreview =
    analysis.report.summary.length > 120
      ? analysis.report.summary.slice(0, 120) + "…"
      : analysis.report.summary;

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-slate-400" />
            <span className="truncate font-semibold text-slate-900">
              {analysis.labFileName}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(analysis.createdAt)}
          </p>
          <p className="mt-2 text-sm text-slate-600 line-clamp-2">
            {summaryPreview}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <Link
            href={`/marketplace?from=analisis&analysisId=${analysis.id}`}
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <Stethoscope className="h-4 w-4" />
            Segunda opinión
          </Link>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            aria-label="Eliminar análisis"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4" />
            Ocultar resumen
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Ver resumen completo
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 text-sm">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Resumen
            </h4>
            <p className="mt-1 leading-relaxed text-slate-700">
              {analysis.report.summary}
            </p>
          </div>
          {analysis.report.keyItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Puntos clave
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                {analysis.report.keyItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.report.nextSteps.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Siguientes pasos
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                {analysis.report.nextSteps.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.report.questions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Preguntas para el médico
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-700">
                {analysis.report.questions.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.report.extraInfo && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Información adicional
              </h4>
              <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700">
                {analysis.report.extraInfo}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalisisPage() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);

  const refresh = useCallback(() => {
    setAnalyses(getAnalyses());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRemove = useCallback((id: string) => {
    removeAnalysis(id);
    setAnalyses(getAnalyses());
  }, []);

  const handleClearAll = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!confirm("¿Borrar todos los análisis? Esta acción no se puede deshacer."))
      return;
    clearAnalyses();
    setAnalyses([]);
  }, []);

  return (
    <div className="min-h-screen bg-[#f6fbfb] text-slate-900">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-gradient-to-br from-teal-200/40 via-sky-200/30 to-white blur-3xl" />
        <div className="absolute left-0 top-40 h-80 w-80 rounded-full bg-gradient-to-tr from-cyan-200/30 via-emerald-200/20 to-white blur-3xl" />
      </div>

      <div className="relative z-10">
        <NavBar />

        <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 lg:px-10">
          <section className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Tus análisis
            </h1>
            <p className="mt-2 text-slate-600">
              Aquí se guardan los análisis que completas en el wizard. Puedes
              solicitar una segunda opinión a un médico del marketplace o
              eliminar los que ya no necesites.
            </p>
          </section>

          {analyses.length > 0 ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm text-slate-500">
                  {analyses.length} análisis guardado{analyses.length !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-sm font-medium text-slate-600 underline hover:text-red-600"
                >
                  Borrar todos
                </button>
              </div>
              <ul className="grid gap-6">
                {analyses.map((analysis) => (
                  <li key={analysis.id}>
                    <AnalysisCard
                      analysis={analysis}
                      onRemove={() => handleRemove(analysis.id)}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/40 py-16 text-center">
              <div className="mb-4 rounded-full bg-slate-100 p-4">
                <Inbox className="h-10 w-10 text-slate-400" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">
                Aún no hay análisis
              </h2>
              <p className="mt-2 max-w-sm text-slate-600">
                Sube tus estudios en Veridoc, completa el wizard y solicita
                segunda opinión para que aquí aparezcan.
              </p>
              <Link
                href="/veridoc"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ir al wizard
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
