"use client";

import Link from "next/link";

// --- COMPONENTES DE DISEÑO ORIGINALES ---
const StatusBadge = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-1 text-xs text-slate-600">
    {children}
  </span>
);

const AbstractAvatar = () => (
  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 shadow-sm ring-1 ring-slate-200/70">
    <span className="h-4 w-4 rounded-full bg-linear-to-br from-teal-500 to-sky-500" />
  </span>
);

export default function CaseDetailTemplate() {
  return (
    <div className="min-h-screen bg-[#f6fbfb] text-slate-900">
      <div className="relative overflow-hidden">
        {/* Background Gradients */}
        <div className="pointer-events-none absolute -top-32 right-0 h-80 w-80 rounded-full bg-linear-to-br from-teal-200/50 via-sky-200/40 to-white blur-3xl" />
        <div className="pointer-events-none absolute left-0 top-40 h-72 w-72 rounded-full bg-linear-to-tr from-cyan-200/40 via-emerald-200/30 to-white blur-3xl" />

        <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-8 pt-8 sm:px-8 lg:px-10">
          <Link href="/marketplace" className="flex items-center gap-3">
            <AbstractAvatar />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                ← Back to Marketplace
              </span>
            </div>
          </Link>
        </header>

        <main className="relative mx-auto w-full max-w-6xl px-6 pb-20 sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* COLUMNA PRINCIPAL */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bloque de Información General */}
              <article className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Hematology
                  </span>
                  <StatusBadge>Urgent</StatusBadge>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 mb-6">
                  Persistent microcytic anemia with borderline ferritin
                </h1>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Clinical Overview
                  </h3>
                  <p className="text-sm leading-7 text-slate-600">
                    Patient presents with chronic fatigue and low hemoglobin
                    levels. Initial tests suggest microcytic anemia, but
                    ferritin levels remain within the lower normal limit.
                    Seeking a specialized second opinion to rule out underlying
                    conditions or atypical iron deficiency.
                  </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-2">
                  <StatusBadge>Second Opinion</StatusBadge>
                  <StatusBadge>Ref: CASE-7721</StatusBadge>
                </div>
              </article>

              {/* Bloque de Archivos (Mockup) */}
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-sm backdrop-blur">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
                  Case Documentation
                </h3>
                <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-white/50">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[10px] uppercase">
                      PDF
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      complete-blood-count.pdf
                    </span>
                  </div>
                  <button className="text-xs font-bold text-teal-600 hover:text-teal-700 transition-colors">
                    Preview
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMNA LATERAL */}
            <aside className="space-y-6">
              <div className="rounded-3xl border border-white/70 bg-white/80 p-8 shadow-sm backdrop-blur">
                <div className="mb-8">
                  <span className="text-xs text-slate-500 block mb-1 font-medium tracking-tight">
                    Expert Review Fee
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-semibold text-slate-900">
                      $85
                    </span>
                    <span className="text-sm font-semibold text-slate-400 uppercase">
                      USD
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button className="w-full rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 shadow-lg shadow-slate-200">
                    Apply for Review
                  </button>
                  <button className="w-full rounded-full border border-slate-200 bg-white/80 px-6 py-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                    Save Case
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
                    Security Protocol
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      <span>End-to-End Encryption</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                      <span>Veridoc Privacy Standard</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
