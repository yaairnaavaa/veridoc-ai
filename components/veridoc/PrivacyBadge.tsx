"use client";

type PrivacyBadgeProps = {
  compact?: boolean;
};

export const PrivacyBadge = ({ compact = false }: PrivacyBadgeProps) => {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 font-semibold text-emerald-700 shadow-sm ${
        compact ? "px-2 py-1 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <span
        className={`flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 ${
          compact ? "h-3.5 w-3.5" : "h-4 w-4"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className={compact ? "h-2.5 w-2.5" : "h-3 w-3"}
          aria-hidden="true"
        >
          <path
            d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 12l2 2 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Runs locally. Nothing is uploaded.
    </div>
  );
};
