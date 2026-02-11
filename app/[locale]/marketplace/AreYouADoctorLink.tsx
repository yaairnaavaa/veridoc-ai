"use client";

import { Link } from "@/i18n/navigation";
import { UserPlus } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

export function AreYouADoctorLink() {
  const { ready, authenticated } = usePrivy();

  if (!ready || !authenticated) return null;

  return (
    <Link
      href="/profile?tab=verified"
      className="flex items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-4 py-2.5 text-sm font-semibold text-teal-800 shadow-sm backdrop-blur transition hover:bg-teal-100"
    >
      <UserPlus className="h-4 w-4" />
      Are you a Doctor?
    </Link>
  );
}
