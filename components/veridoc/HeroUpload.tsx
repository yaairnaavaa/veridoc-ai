"use client";

import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { useRouter } from "next/navigation";
import { setPendingLabsFile } from "@/lib/veridoc/sessionStore";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
];

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

export const HeroUpload = () => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "Please upload a PDF or image file (PNG, JPG, JPEG).";
    }
    if (file.size > MAX_FILE_BYTES) {
      return `File is too large. Max size is ${formatBytes(
        MAX_FILE_BYTES,
      )}.`;
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
    setPendingLabsFile(file);
    router.push("/veridoc");
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

  return (
    <div className="grid gap-3">
      <div
        id="hero-upload"
        className={`rounded-3xl border border-dashed px-6 py-6 text-center transition ${
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
        <p className="text-sm font-semibold text-slate-800">
          Drag and drop your lab file
        </p>
        <p className="mt-2 text-xs text-slate-500">
          PDF, PNG, JPG, JPEG. Max {formatBytes(MAX_FILE_BYTES)}.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          Browse files
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      <p className="text-xs text-slate-500">
        Runs locally. Nothing is uploaded or stored.
      </p>
    </div>
  );
};
