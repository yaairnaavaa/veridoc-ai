"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { getAnalyses, type SavedAnalysis } from "@/lib/veridoc/analysesStore";
import { FileText, Send, Loader2 } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type RequestSecondOpinionProps = {
  specialistId: string;
  specialistName: string;
  priceUsdt: number;
};

export function RequestSecondOpinion({
  specialistId,
  specialistName,
  priceUsdt,
}: RequestSecondOpinionProps) {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAnalyses(getAnalyses());
  }, []);

  const handleSubmit = useCallback(() => {
    if (!selectedId) return;
    setSubmitting(true);
    // Mockup: simular envío
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 1500);
  }, [selectedId]);

  if (analyses.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur">
        <h3 className="text-sm font-semibold text-slate-900">
          Enviar mis análisis y solicitar segunda opinión
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          No tienes análisis guardados. Completa el wizard en Veridoc para generar un análisis y luego podrás enviarlo a este especialista.
        </p>
        <Link
          href="/veridoc"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          Ir al wizard
        </Link>
        <Link
          href="/analisis"
          className="ml-3 inline-flex text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Ver mis análisis
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/80 p-6 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3 text-emerald-800">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
            <Send className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">Solicitud enviada</h3>
            <p className="text-sm text-emerald-700">
              Tu análisis ha sido enviado a {specialistName}. Recibirás la segunda opinión en el plazo indicado (p. ej. 24–48 h). Este es un mockup; en producción se procesaría el pago y la notificación al especialista.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur">
      <h3 className="text-sm font-semibold text-slate-900">
        Enviar mis análisis y solicitar segunda opinión
      </h3>
      <p className="mt-1 text-xs text-slate-500">
        Elige un análisis guardado para enviarlo a {specialistName}. El costo de la revisión es de <strong>{priceUsdt} USDT</strong>.
      </p>

      <div className="mt-4 space-y-2">
        {analyses.map((a) => (
          <label
            key={a.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
              selectedId === a.id
                ? "border-teal-300 bg-teal-50/50 ring-1 ring-teal-200/60"
                : "border-slate-200 bg-slate-50/50 hover:border-slate-300"
            }`}
          >
            <input
              type="radio"
              name="analysis"
              value={a.id}
              checked={selectedId === a.id}
              onChange={() => setSelectedId(a.id)}
              className="h-4 w-4 border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <FileText className="h-5 w-5 shrink-0 text-slate-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {a.labFileName}
              </p>
              <p className="text-xs text-slate-500">{formatDate(a.createdAt)}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!selectedId || submitting}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Pagar {priceUsdt} USDT y solicitar segunda opinión
            </>
          )}
        </button>
        <Link
          href="/analisis"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Ver todos mis análisis
        </Link>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Mockup: el pago y el envío al especialista se simulan. En producción se conectaría con wallet y backend.
      </p>
    </div>
  );
}
