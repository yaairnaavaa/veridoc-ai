"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import type { DiagnosisMode } from "@/lib/veridoc/localInference";

 const ACCEPTED_TYPES = [
   "application/pdf",
   "image/png",
   "image/jpeg",
 ];

 type StepDiagnosisProps = {
   diagnosisMode: DiagnosisMode;
   diagnosisFile: File | null;
   diagnosisText: string;
   maxBytes: number;
   formatBytes: (bytes: number) => string;
   onModeChange: (mode: DiagnosisMode) => void;
   onFileSelect: (file: File) => void;
   onTextChange: (text: string) => void;
   onBack: () => void;
   onContinue: () => void;
   onClearFile: () => void;
 };

export const StepDiagnosis = ({
   diagnosisMode,
   diagnosisFile,
   diagnosisText,
   maxBytes,
   formatBytes,
   onModeChange,
   onFileSelect,
   onTextChange,
   onBack,
   onContinue,
   onClearFile,
 }: StepDiagnosisProps) => {
   const inputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
   const [isDragging, setIsDragging] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [previewUrl, setPreviewUrl] = useState<string | null>(null);

   useEffect(() => {
     if (!diagnosisFile) {
       setPreviewUrl(null);
       return;
     }
     const url = URL.createObjectURL(diagnosisFile);
     setPreviewUrl(url);
     return () => {
       URL.revokeObjectURL(url);
     };
   }, [diagnosisFile]);

  useEffect(() => {
    setError(null);
  }, [diagnosisMode]);

  useEffect(() => {
    if (diagnosisMode !== "text") {
      return;
    }
    if (!textAreaRef.current) {
      return;
    }
    textAreaRef.current.style.height = "auto";
    textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
  }, [diagnosisMode, diagnosisText]);

   const validateFile = (file: File) => {
     if (!ACCEPTED_TYPES.includes(file.type)) {
       return "Please upload a PDF or image file (PNG, JPG, JPEG).";
     }
     if (file.size > maxBytes) {
       return `File is too large. Max size is ${formatBytes(maxBytes)}.`;
     }
     return null;
   };

   const handleFile = (file: File) => {
     const validationError = validateFile(file);
     if (validationError) {
       setError(validationError);
       return;
     }
     setError(null);
     onFileSelect(file);
   };

   const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (file) {
       handleFile(file);
     }
   };

   const handleDrop = (event: DragEvent<HTMLDivElement>) => {
     event.preventDefault();
     setIsDragging(false);
     const file = event.dataTransfer.files?.[0];
     if (file) {
       handleFile(file);
     }
   };

   const isPdf = diagnosisFile?.type === "application/pdf";

   const handleContinue = () => {
     if (diagnosisMode === "file" && !diagnosisFile) {
       setError("Please upload a diagnosis file or choose another option.");
       return;
     }
     setError(null);
     onContinue();
   };

  const characterCount = diagnosisText.length;

  return (
    <section className="grid gap-6 pb-24 sm:pb-0">
      <div className="rounded-3xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur sm:p-6">
         <div className="flex flex-col gap-3">
           <h2 className="text-xl font-semibold text-slate-900">
             Upload diagnosis (optional)
           </h2>
           <p className="text-sm text-slate-600">
             Add a diagnosis file or notes if you have them. You can also skip
             this step.
           </p>
         </div>

        <div
          role="tablist"
          aria-label="Diagnosis options"
          className="mt-5 grid gap-2 rounded-2xl border border-slate-200/70 bg-white/80 p-2 sm:grid-cols-3 sm:gap-3"
        >
           {[
             { id: "file", label: "I have a diagnosis file" },
             { id: "text", label: "Paste diagnosis text" },
             { id: "none", label: "I don't have a diagnosis" },
           ].map((option) => (
             <button
               key={option.id}
               type="button"
               role="tab"
               aria-selected={diagnosisMode === option.id}
               onClick={() => onModeChange(option.id as DiagnosisMode)}
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
           {diagnosisMode === "file" ? (
             <div className="grid gap-4">
              <div
                className={`rounded-3xl border border-dashed px-5 py-6 text-center transition ${
                   isDragging
                     ? "border-teal-400 bg-teal-50/60"
                     : "border-slate-200 bg-white/80"
                 }`}
                 onDragOver={(event) => {
                   event.preventDefault();
                   setIsDragging(true);
                 }}
                 onDragLeave={() => setIsDragging(false)}
                 onDrop={handleDrop}
               >
                 <input
                   ref={inputRef}
                   type="file"
                   accept={ACCEPTED_TYPES.join(",")}
                   onChange={handleInputChange}
                   className="hidden"
                 />
                 <p className="text-sm font-medium text-slate-700">
                   Drop your diagnosis file here
                 </p>
                 <p className="mt-2 text-xs text-slate-500">or</p>
                 <button
                   type="button"
                   onClick={() => inputRef.current?.click()}
                  className="mt-3 inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                 >
                   Browse files
                 </button>
               </div>

               {diagnosisFile ? (
                 <div className="grid gap-4">
                   <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 text-sm text-slate-700">
                     <div className="flex flex-wrap items-center justify-between gap-2">
                       <div>
                         <p className="font-semibold text-slate-900">
                           {diagnosisFile.name}
                         </p>
                         <p className="text-xs text-slate-500">
                           {diagnosisFile.type || "Unknown type"} |{" "}
                           {formatBytes(diagnosisFile.size)}
                         </p>
                       </div>
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          onClearFile();
                        }}
                        className="inline-flex h-11 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        Remove file
                      </button>
                     </div>
                   </div>

                   {previewUrl ? (
                     <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
                       {isPdf ? (
                         <object
                           data={previewUrl}
                           type="application/pdf"
                           className="h-64 w-full"
                           aria-label="Diagnosis PDF preview"
                         >
                           <div className="p-4 text-sm text-slate-600">
                             Preview unavailable. Please download the file to
                             view it.
                           </div>
                         </object>
                       ) : (
                         <img
                           src={previewUrl}
                           alt="Diagnosis upload preview"
                           className="h-64 w-full object-contain"
                         />
                       )}
                     </div>
                   ) : null}
                 </div>
               ) : null}
             </div>
           ) : null}

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
               No diagnosis added. We'll generate a summary from the lab report
               only.
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
