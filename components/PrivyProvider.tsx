"use client";

import { PrivyProvider as PrivyProviderBase } from "@privy-io/react-auth";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  if (!appId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
        Configure <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_PRIVY_APP_ID</code> in your environment.
        Get your App ID from the{" "}
        <a
          href="https://dashboard.privy.io"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Privy Dashboard
        </a>
        .
      </div>
    );
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        loginMethods: ["passkey", "email", "google", "wallet"],
        appearance: {
          theme: "light",
          accentColor: "#0f766e",
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
