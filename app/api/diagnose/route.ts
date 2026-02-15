import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/diagnose
 * Diagnóstico del entorno: variables de relay/escrow y prueba de carga de dependencias.
 * No expone valores secretos. Útil para depurar 500 en producción.
 *
 * Query: ?relay=1 — intenta cargar las mismas dependencias que relay-escrow-deposit y devuelve cualquier error.
 */
export async function GET(request: NextRequest) {
  const out: Record<string, unknown> = {
    ok: true,
    env: {
      NEAR_RELAYER_ACCOUNT_ID: !!process.env.NEAR_RELAYER_ACCOUNT_ID ? "set" : "missing",
      NEAR_RELAYER_PRIVATE_KEY: !!process.env.NEAR_RELAYER_PRIVATE_KEY ? "set" : "missing",
      ESCROW_ACCOUNT_ID: !!process.env.ESCROW_ACCOUNT_ID ? "set" : "missing",
      ESCROW_PRIVATE_KEY: !!process.env.ESCROW_PRIVATE_KEY ? "set" : "missing",
      NEAR_FAUCET_ACCOUNT_ID: !!process.env.NEAR_FAUCET_ACCOUNT_ID ? "set" : "missing",
      NEAR_FAUCET_PRIVATE_KEY: !!process.env.NEAR_FAUCET_PRIVATE_KEY ? "set" : "missing",
      CRON_SECRET: !!process.env.CRON_SECRET ? "set" : "missing",
    },
    nodeEnv: process.env.NODE_ENV,
  };

  const tryRelay = request.nextUrl.searchParams.get("relay") === "1";

  if (tryRelay) {
    try {
      const { createRequire } = await import("module");
      const path = await import("path");
      const cwd = process.cwd();
      const pkgPath = path.join(cwd, "node_modules/@near-js/transactions/package.json");
      const requireNearBorsh = createRequire(pkgPath);
      requireNearBorsh("borsh");
      out.relayDeps = "borsh loaded OK";

      const { KeyPairSigner } = await import("@near-js/signers");
      const key = process.env.NEAR_RELAYER_PRIVATE_KEY;
      if (key) {
        KeyPairSigner.fromSecretKey(key as never);
        out.relayDeps = "borsh + KeyPairSigner OK";
      } else {
        out.relayDeps = "borsh OK, NEAR_RELAYER_PRIVATE_KEY missing (no KeyPairSigner test)";
      }
    } catch (e) {
      out.ok = false;
      out.relayDepsError = e instanceof Error ? e.message : String(e);
      out.relayDepsErrorName = e instanceof Error ? e.name : undefined;
      out.relayDepsStack = e instanceof Error ? e.stack : undefined;
    }
  }

  return NextResponse.json(out);
}
