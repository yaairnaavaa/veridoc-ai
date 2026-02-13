import { NextResponse } from "next/server";
import { NEAR_NETWORK, NEAR_RPC_URL } from "@/lib/near-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Max time (ms) for any single external request. */
const FETCH_TIMEOUT_MS = 7_000;
/** Max time (ms) for the entire GET handler before returning partial results. */
const GLOBAL_TIMEOUT_MS = 15_000;

type ServiceStatus = "ok" | "error" | "unconfigured";

interface CheckResult {
  name: string;
  status: ServiceStatus;
  message: string;
  latencyMs?: number;
  required?: boolean;
  envVars?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** fetch() with an AbortController timeout so it never hangs forever. */
function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const ms = init?.timeoutMs ?? FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/** Wrap any async check so it resolves to an error result on timeout. */
function withTimeout(
  promise: Promise<CheckResult>,
  fallbackName: string,
  ms = FETCH_TIMEOUT_MS,
): Promise<CheckResult> {
  return Promise.race([
    promise,
    new Promise<CheckResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            name: fallbackName,
            status: "error",
            message: `Timeout (${ms / 1000}s) — el servicio no respondió a tiempo`,
            latencyMs: ms,
            required: true,
          }),
        ms,
      ),
    ),
  ]);
}

async function checkPrivy(): Promise<CheckResult> {
  const envVars = ["NEXT_PUBLIC_PRIVY_APP_ID"];
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId || appId.trim() === "") {
    return {
      name: "Privy (auth)",
      status: "unconfigured",
      message: "NEXT_PUBLIC_PRIVY_APP_ID no está configurada. Necesaria para login y wallets.",
      required: true,
      envVars,
    };
  }
  return {
    name: "Privy (auth)",
    status: "ok",
    message: "App ID configurada (login y wallets)",
    required: true,
    envVars,
  };
}

async function checkNearRpc(): Promise<CheckResult> {
  const start = Date.now();
  const envVars = ["NEXT_PUBLIC_NEAR_NETWORK"];
  try {
    const res = await fetchWithTimeout(NEAR_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "status",
        method: "status",
        params: [],
      }),
    });
    const latencyMs = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    if (data.result?.sync_info) {
      return {
        name: "NEAR RPC",
        status: "ok",
        message: `${NEAR_NETWORK} — nodo accesible (${NEAR_RPC_URL})`,
        latencyMs,
        required: true,
        envVars,
      };
    }
    return {
      name: "NEAR RPC",
      status: "error",
      message: data.error?.message ?? `RPC respondió sin sync_info: ${res.status}`,
      latencyMs,
      required: true,
      envVars,
    };
  } catch (error: unknown) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const msg = isTimeout
      ? "Timeout — el nodo RPC no respondió a tiempo"
      : error instanceof Error ? error.message : "Error de conexión";
    return {
      name: "NEAR RPC",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: true,
      envVars,
    };
  }
}

async function checkNearFunding(): Promise<CheckResult> {
  const envVars = ["NEAR_FAUCET_ACCOUNT_ID", "NEAR_FAUCET_PRIVATE_KEY", "NEAR_TESTNET_FAUCET_API_URL"];
  const faucetAccountId = process.env.NEAR_FAUCET_ACCOUNT_ID;
  const faucetPrivateKey = process.env.NEAR_FAUCET_PRIVATE_KEY;
  const testnetFaucetUrl = process.env.NEAR_TESTNET_FAUCET_API_URL;
  const hasFaucet = !!(faucetAccountId && faucetPrivateKey);
  const hasExternalTestnet = NEAR_NETWORK === "testnet" && !!testnetFaucetUrl;
  if (hasFaucet) {
    return {
      name: "NEAR funding (faucet)",
      status: "ok",
      message: "Cuenta faucet configurada para financiar cuentas implícitas",
      required: false,
      envVars,
    };
  }
  if (hasExternalTestnet) {
    return {
      name: "NEAR funding (faucet)",
      status: "ok",
      message: "Faucet externo configurado (NEAR_TESTNET_FAUCET_API_URL)",
      required: false,
      envVars,
    };
  }
  return {
    name: "NEAR funding (faucet)",
    status: "unconfigured",
    message:
      "Configura NEAR_FAUCET_ACCOUNT_ID y NEAR_FAUCET_PRIVATE_KEY, o (solo testnet) NEAR_TESTNET_FAUCET_API_URL para que los usuarios puedan activar su cuenta.",
    required: false,
    envVars,
  };
}

async function checkNearRelay(): Promise<CheckResult> {
  const envVars = ["NEAR_RELAYER_ACCOUNT_ID", "NEAR_RELAYER_PRIVATE_KEY", "NEXT_PUBLIC_NEAR_RELAYER_ACCOUNT_ID"];
  const relayerAccountId = process.env.NEAR_RELAYER_ACCOUNT_ID ?? process.env.NEXT_PUBLIC_NEAR_RELAYER_ACCOUNT_ID;
  const relayerPrivateKey = process.env.NEAR_RELAYER_PRIVATE_KEY;
  if (!relayerAccountId || !relayerPrivateKey) {
    return {
      name: "NEAR relay (withdraw)",
      status: "unconfigured",
      message: "NEAR_RELAYER_ACCOUNT_ID y NEAR_RELAYER_PRIVATE_KEY necesarios para retiros USDT",
      required: false,
      envVars,
    };
  }
  return {
    name: "NEAR relay (withdraw)",
    status: "ok",
    message: `Relayer configurado para retiros (${relayerAccountId})`,
    required: false,
    envVars,
  };
}

// PDF mínimo válido para probar upload sin consumir quota real
const MINIMAL_PDF = new Uint8Array(
  Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF",
    "utf8"
  )
);

const LLAMA_API_URL = "https://api.cloud.llamaindex.ai/api/parsing";

async function checkLlamaCloud(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.LLAMA_CLOUD_API_KEY;
  const serviceName = "LlamaParse";
  const envVars = ["LLAMA_CLOUD_API_KEY"];
  if (!key) {
    return {
      name: serviceName,
      status: "unconfigured",
      message: "LLAMA_CLOUD_API_KEY no está configurada (análisis de PDFs)",
      required: true,
      envVars,
    };
  }
  try {
    const form = new FormData();
    form.append("file", new Blob([MINIMAL_PDF], { type: "application/pdf" }), "status-check.pdf");
    const res = await fetchWithTimeout(`${LLAMA_API_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const jobId = data.id ?? data.job_id;
      return {
        name: serviceName,
        status: "ok",
        message: jobId
          ? "Upload de prueba correcto; servicio accesible desde este servidor."
          : "Servicio respondió correctamente.",
        latencyMs,
        required: true,
        envVars,
      };
    }
    const errBody = await res.text();
    let detail = errBody.slice(0, 200);
    try {
      const j = JSON.parse(errBody);
      detail = j.detail ?? j.message ?? detail;
    } catch {
      /* use errBody slice */
    }
    if (res.status === 401 || res.status === 403) {
      return {
        name: serviceName,
        status: "error",
        message: `API key inválida o sin permisos: ${detail}`,
        latencyMs,
        required: true,
        envVars,
      };
    }
    return {
      name: serviceName,
      status: "error",
      message: `Error ${res.status} desde LlamaParse: ${detail}`,
      latencyMs,
      required: true,
      envVars,
    };
  } catch (error: unknown) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const msg = isTimeout
      ? "Timeout — LlamaParse no respondió a tiempo"
      : error instanceof Error ? error.message : "Error desconocido";
    return {
      name: serviceName,
      status: "error",
      message: isTimeout ? msg : `No se pudo conectar con LlamaParse (¿firewall/red en producción?): ${msg}`,
      latencyMs: Date.now() - start,
      required: true,
      envVars,
    };
  }
}

async function checkNearAI(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.NEAR_AI_API_KEY;
  const envVars = ["NEAR_AI_API_KEY"];
  if (!key) {
    return {
      name: "NEAR AI",
      status: "unconfigured",
      message: "NEAR_AI_API_KEY no está configurada (análisis con IA)",
      required: true,
      envVars,
    };
  }
  try {
    // Use /v1/models (GET, lightweight) instead of chat/completions to avoid
    // model-loading latency that causes 504s in production.
    const res = await fetchWithTimeout("https://cloud-api.near.ai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        name: "NEAR AI",
        status: "ok",
        message: "API key válida, servicio disponible",
        latencyMs,
        required: true,
        envVars,
      };
    }
    const body = await res.json().catch(() => ({}));
    const detail = body?.error?.message || body?.detail || res.statusText;
    if (res.status === 401 || res.status === 403) {
      return {
        name: "NEAR AI",
        status: "error",
        message: `API key inválida o sin permisos: ${detail}`,
        latencyMs,
        required: true,
        envVars,
      };
    }
    return {
      name: "NEAR AI",
      status: "error",
      message: `${res.status}: ${detail}`,
      latencyMs,
      required: true,
      envVars,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message
      : (error as { name?: string })?.name === "AbortError"
        ? "Timeout — el servicio no respondió a tiempo"
        : "Error de conexión";
    return {
      name: "NEAR AI",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: true,
      envVars,
    };
  }
}

function checkCloudinary(): CheckResult {
  const envVars = ["CLOUDINARY_URL", "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  const url = process.env.CLOUDINARY_URL;
  if (url?.startsWith("cloudinary://")) {
    try {
      const u = new URL(url);
      const cloudName = u.hostname || u.host;
      const apiKey = decodeURIComponent(u.username);
      const apiSecret = decodeURIComponent(u.password);
      if (cloudName && apiKey && apiSecret) {
        return {
          name: "Cloudinary",
          status: "ok",
          message: "CLOUDINARY_URL configurada (fotos y documentos de especialistas)",
          required: false,
          envVars,
        };
      }
    } catch {
      // fallback a variables separadas
    }
  }
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) {
    return {
      name: "Cloudinary",
      status: "ok",
      message: "Variables de Cloudinary configuradas",
      required: false,
      envVars,
    };
  }
  return {
    name: "Cloudinary",
    status: "unconfigured",
    message:
      "CLOUDINARY_URL o (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) para subir fotos y documentos de especialistas",
    required: false,
    envVars,
  };
}

function checkNearIntentsSolver(): CheckResult {
  const envVars = ["NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY"];
  const key = process.env.NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY;
  if (!key || key.trim() === "") {
    return {
      name: "NEAR Intents Solver Relay",
      status: "unconfigured",
      message: 'NEXT_PUBLIC_NEAR_INTENTS_SOLVER_RELAY_API_KEY no configurada. Puede causar errores "base58" en retiros POA.',
      required: false,
      envVars,
    };
  }
  return {
    name: "NEAR Intents Solver Relay",
    status: "ok",
    message: "API key del solver relay configurada (retiros POA)",
    required: false,
    envVars,
  };
}

async function checkSpecialistVerificationApi(): Promise<CheckResult> {
  const envVars = ["SPECIALIST_VERIFICATION_API_URL"];
  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return {
      name: "API verificación especialistas",
      status: "unconfigured",
      message: "SPECIALIST_VERIFICATION_API_URL no configurada. Marketplace y perfiles de especialistas usan la API interna si no está definida.",
      required: false,
      envVars,
    };
  }
  const start = Date.now();
  try {
    // Solo comprobamos que el origen responda (GET al base URL o /api/status si existe)
    const res = await fetchWithTimeout(`${baseUrl}/api/status`, { method: "GET" });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        name: "API verificación especialistas",
        status: "ok",
        message: "Servicio externo accesible",
        latencyMs,
        required: false,
        envVars,
      };
    }
    // 404 = servicio up pero sin endpoint /api/status; lo consideramos accesible
    if (res.status === 404) {
      return {
        name: "API verificación especialistas",
        status: "ok",
        message: "Origen accesible (sin endpoint /api/status)",
        latencyMs,
        required: false,
        envVars,
      };
    }
    return {
      name: "API verificación especialistas",
      status: "error",
      message: `${res.status} — el endpoint externo no respondió correctamente`,
      latencyMs,
      required: false,
      envVars,
    };
  } catch (error: unknown) {
    const isTimeout = error instanceof DOMException && error.name === "AbortError";
    const msg = isTimeout
      ? "Timeout — el servicio externo no respondió a tiempo"
      : error instanceof Error ? error.message : "Error de conexión";
    return {
      name: "API verificación especialistas",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: false,
      envVars,
    };
  }
}

function checkEscrow(): CheckResult {
  const envVars = ["ESCROW_ACCOUNT_ID", "ESCROW_PRIVATE_KEY", "PLATFORM_FEE_ACCOUNT_ID"];
  const accountId = process.env.ESCROW_ACCOUNT_ID ?? process.env.NEXT_PUBLIC_ESCROW_ACCOUNT_ID;
  const privateKey = process.env.ESCROW_PRIVATE_KEY;
  if (!accountId || !privateKey) {
    return {
      name: "Escrow (segunda opinión)",
      status: "unconfigured",
      message:
        "ESCROW_ACCOUNT_ID y ESCROW_PRIVATE_KEY necesarios para depósito y liberación de pagos de segunda opinión.",
      required: false,
      envVars,
    };
  }
  return {
    name: "Escrow (segunda opinión)",
    status: "ok",
    message: `Cuenta escrow configurada (${accountId})`,
    required: false,
    envVars,
  };
}

function checkCronReleaseEscrow(): CheckResult {
  const envVars = ["CRON_SECRET"];
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim() === "") {
    return {
      name: "Cron (release escrow)",
      status: "unconfigured",
      message: "CRON_SECRET no configurada. El cron que libera pagos a especialistas no podrá autorizarse.",
      required: false,
      envVars,
    };
  }
  return {
    name: "Cron (release escrow)",
    status: "ok",
    message: "CRON_SECRET configurada (cron de liberación de pagos)",
    required: false,
    envVars,
  };
}

async function checkEscrowAccountOnChain(): Promise<CheckResult> {
  const accountId = process.env.ESCROW_ACCOUNT_ID ?? process.env.NEXT_PUBLIC_ESCROW_ACCOUNT_ID;
  const envVars = ["ESCROW_ACCOUNT_ID"];
  if (!accountId) {
    return {
      name: "Escrow en NEAR (on-chain)",
      status: "unconfigured",
      message: "ESCROW_ACCOUNT_ID no configurada; no se comprueba la cuenta on-chain.",
      required: false,
      envVars,
    };
  }
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(NEAR_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "status",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
    });
    const latencyMs = Date.now() - start;
    const data = await res.json().catch(() => ({}));
    if (data.result?.amount !== undefined) {
      return {
        name: "Escrow en NEAR (on-chain)",
        status: "ok",
        message: `Cuenta ${accountId} existe en ${NEAR_NETWORK}`,
        latencyMs,
        required: false,
        envVars,
      };
    }
    return {
      name: "Escrow en NEAR (on-chain)",
      status: "error",
      message: data.error?.message ?? `Cuenta ${accountId} no encontrada o RPC error: ${res.status}`,
      latencyMs,
      required: false,
      envVars,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error de conexión";
    return {
      name: "Escrow en NEAR (on-chain)",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: false,
      envVars,
    };
  }
}

async function runAllChecks() {
  const [
    privy,
    nearRpc,
    nearFunding,
    nearRelay,
    llama,
    nearAI,
    cloudinary,
    nearIntents,
    specialistApi,
    escrow,
    cronEscrow,
    escrowOnChain,
  ] = await Promise.all([
    checkPrivy(),
    withTimeout(checkNearRpc(), "NEAR RPC"),
    checkNearFunding(),
    checkNearRelay(),
    withTimeout(checkLlamaCloud(), "LlamaParse"),
    withTimeout(checkNearAI(), "NEAR AI"),
    Promise.resolve(checkCloudinary()),
    Promise.resolve(checkNearIntentsSolver()),
    withTimeout(checkSpecialistVerificationApi(), "API verificación especialistas", FETCH_TIMEOUT_MS),
    Promise.resolve(checkEscrow()),
    Promise.resolve(checkCronReleaseEscrow()),
    withTimeout(checkEscrowAccountOnChain(), "Escrow en NEAR (on-chain)"),
  ]);

  return [
    privy,
    nearRpc,
    nearFunding,
    nearRelay,
    llama,
    nearAI,
    cloudinary,
    nearIntents,
    specialistApi,
    escrow,
    cronEscrow,
    escrowOnChain,
  ];
}

function buildResponse(checks: CheckResult[]) {
  const requiredChecks = checks.filter((c) => c.required !== false);
  const allRequiredOk = requiredChecks.every((c) => c.status === "ok");
  const anyRequiredError = requiredChecks.some((c) => c.status === "error");
  const anyRequiredUnconfigured = requiredChecks.some((c) => c.status === "unconfigured");
  const anyUnconfigured = checks.some((c) => c.status === "unconfigured");

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (anyRequiredError) status = "unhealthy";
  else if (!allRequiredOk || anyRequiredUnconfigured) status = "unhealthy";
  else if (anyUnconfigured) status = "degraded";

  const counts = {
    ok: checks.filter((c) => c.status === "ok").length,
    error: checks.filter((c) => c.status === "error").length,
    unconfigured: checks.filter((c) => c.status === "unconfigured").length,
    total: checks.length,
  };

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    environment: {
      nearNetwork: NEAR_NETWORK,
      nodeEnv: process.env.NODE_ENV ?? "unknown",
    },
    counts,
    services: checks,
  });
}

export async function GET() {
  // Global safety net: if all checks together exceed GLOBAL_TIMEOUT_MS,
  // return whatever we have so the gateway never returns 504.
  const result = await Promise.race([
    runAllChecks(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), GLOBAL_TIMEOUT_MS)),
  ]);

  if (result) {
    return buildResponse(result);
  }

  // Global timeout hit — return a minimal error response so the page still renders.
  return NextResponse.json(
    {
      status: "unhealthy" as const,
      timestamp: new Date().toISOString(),
      environment: {
        nearNetwork: NEAR_NETWORK,
        nodeEnv: process.env.NODE_ENV ?? "unknown",
      },
      counts: { ok: 0, error: 1, unconfigured: 0, total: 1 },
      services: [
        {
          name: "Status check",
          status: "error" as const,
          message: `Los checks no terminaron en ${GLOBAL_TIMEOUT_MS / 1000}s. Puede haber un servicio externo caído o lento. Reintenta en unos segundos.`,
          latencyMs: GLOBAL_TIMEOUT_MS,
          required: true,
        },
      ],
    },
    { status: 200 }, // 200 so the frontend can still parse and show the message
  );
}
