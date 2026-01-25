"use client";

import { useMemo } from "react";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";
import { generateLocalRecommendation } from "@/lib/veridoc/localInference";

 type StepResultsProps = {
   labsFile: File;
   diagnosisMode: DiagnosisMode;
   diagnosisFile: File | null;
   diagnosisText: string;
   formatBytes: (bytes: number) => string;
   onStartOver: () => void;
   onClearSession: () => void;
   onBack: () => void;
 };

 export const StepResults = ({
   labsFile,
   diagnosisMode,
   diagnosisFile,
   diagnosisText,
   formatBytes,
   onStartOver,
   onClearSession,
   onBack,
 }: StepResultsProps) => {
   const report = useMemo(
     () =>
       generateLocalRecommendation({
         labsFile,
         diagnosisMode,
         diagnosisFile,
         diagnosisText,
       }),
     [labsFile, diagnosisMode, diagnosisFile, diagnosisText],
   );

   const handleDownload = () => {
     const content = [
       "Veridoc - Local Recommendation Summary",
       "",
       report.summary,
       "",
       "Key items to review:",
       ...report.keyItems.map((item) => `- ${item}`),
       "",
       "Next steps:",
       ...report.nextSteps.map((item) => `- ${item}`),
       "",
       "Questions to ask your clinician:",
       ...report.questions.map((item) => `- ${item}`),
       "",
       report.disclaimer,
     ].join("\n");

     const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.href = url;
     link.download = "veridoc-summary.txt";
     document.body.appendChild(link);
     link.click();
     document.body.removeChild(link);
     window.setTimeout(() => URL.revokeObjectURL(url), 500);
   };

   const diagnosisLabel =
     diagnosisMode === "file"
       ? diagnosisFile?.name || "Diagnosis file"
       : diagnosisMode === "text"
         ? "Diagnosis notes"
         : "No diagnosis";

  return (
    <section className="grid gap-6 pb-24 sm:pb-0">
      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
         <div className="flex flex-col gap-2">
           <h2 className="text-xl font-semibold text-slate-900">
             Recommendation report
           </h2>
           <p className="text-sm text-slate-600">
             Generated locally from your uploads. Nothing leaves your device.
           </p>
         </div>

         <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
             <div>
               <p className="text-xs text-slate-500">Lab file</p>
               <p className="font-semibold text-slate-900">{labsFile.name}</p>
               <p className="text-xs text-slate-500">
                 {labsFile.type || "Unknown type"} | {formatBytes(labsFile.size)}
               </p>
             </div>
             <div>
               <p className="text-xs text-slate-500">Diagnosis input</p>
               <p className="font-semibold text-slate-900">{diagnosisLabel}</p>
             </div>
           </div>
         </div>

         <div className="mt-6 grid gap-5">
           <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
             <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
             <p className="mt-2 text-sm leading-7 text-slate-600">
               {report.summary}
             </p>
           </div>

           <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
             <h3 className="text-sm font-semibold text-slate-900">
               Key items to review
             </h3>
             <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
               {report.keyItems.map((item) => (
                 <li key={item}>{item}</li>
               ))}
             </ul>
           </div>

           <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-5">
             <h3 className="text-sm font-semibold text-slate-900">
               Next steps &amp; questions
             </h3>
             <div className="mt-3 grid gap-4 sm:grid-cols-2">
               <div>
                 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                   Next steps
                 </p>
                 <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                   {report.nextSteps.map((item) => (
                     <li key={item}>{item}</li>
                   ))}
                 </ul>
               </div>
               <div>
                 <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                   Questions to ask
                 </p>
                 <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">
                   {report.questions.map((item) => (
                     <li key={item}>{item}</li>
                   ))}
                 </ul>
               </div>
             </div>
           </div>

           <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-xs text-amber-700">
             {report.disclaimer}
           </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Session actions
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onStartOver}
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Start over
              </button>
              <button
                type="button"
                onClick={onClearSession}
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Clear session
              </button>
            </div>
          </div>
         </div>
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
            onClick={handleDownload}
            className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Download summary
          </button>
        </div>
      </div>
     </section>
   );
 };
