"use client";

import Link from "next/link";
import { ChevronRight, Stethoscope, ShieldCheck } from "lucide-react";

type StepSecondOpinionProps = {
  analysisId?: string;
  onBack: () => void;
  onStartOver: () => void;
};

export const StepSecondOpinion = ({
  analysisId,
  onBack,
  onStartOver,
}: StepSecondOpinionProps) => {
  const marketplaceHref = analysisId ? `/marketplace?from=wizard&analysisId=${analysisId}` : "/marketplace?from=wizard";

  return (
    <section className="grid gap-6 pb-24 sm:pb-0">
      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Solicitar segunda opinión
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Lleva tus estudios y el pronóstico que generaste a un médico certificado.
            En el marketplace puedes elegir un especialista, pagar con USDT y enviar
            tus datos de forma segura para obtener una segunda opinión profesional.
          </p>
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-teal-600" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-800">Anónimo y bajo tu control</p>
              <p className="mt-1">
                Subes tus análisis en Veridoc, obtienes el pronóstico por inferencia privada
                y, si quieres, pagas solo por solicitar la opinión de un médico verificado.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href={marketplaceHref}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 hover:shadow-lg active:scale-[0.98]"
          >
            Ir al marketplace de especialistas
            <ChevronRight className="h-4 w-4 opacity-80" />
          </Link>
          <p className="text-center text-xs text-slate-500">
            Podrás ver todos tus análisis en la página{" "}
            <Link href="/analisis" className="font-medium text-teal-700 underline hover:text-teal-800">
              Análisis
            </Link>
            .
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Otras acciones
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Volver al pronóstico
            </button>
            <button
              type="button"
              onClick={onStartOver}
              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Empezar de nuevo
            </button>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-white/70 bg-[#f5fbfb]/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            Atrás
          </button>
        </div>
      </div>
    </section>
  );
};
