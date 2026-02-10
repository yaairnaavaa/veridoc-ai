import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import { NEAR_NETWORK, NEAR_RPC_URL } from "@/lib/near-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ServiceStatus = "ok" | "error" | "unconfigured";

interface CheckResult {
  name: string;
  status: ServiceStatus;
  message: string;
  latencyMs?: number;
  required?: boolean;
}

async function checkMongoDB(): Promise<CheckResult> {
  const start = Date.now();
  try {
    if (!process.env.MONGODB_URI) {
      return {
        name: "MongoDB",
        status: "unconfigured",
        message: "MONGODB_URI no está configurada",
        required: true,
      };
    }
    const conn = await dbConnect();
    const db = conn.connection.db;
    if (!db) {
      return {
        name: "MongoDB",
        status: "error",
        message: "No se pudo obtener la instancia de la base de datos",
        latencyMs: Date.now() - start,
        required: true,
      };
    }
    await db.admin().command({ ping: 1 });
    return {
      name: "MongoDB",
      status: "ok",
      message: `Conectado (${conn.connection.name})`,
      latencyMs: Date.now() - start,
      required: true,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return {
      name: "MongoDB",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: true,
    };
  }
}

async function checkPrivy(): Promise<CheckResult> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId || appId.trim() === "") {
    return {
      name: "Privy (auth)",
      status: "unconfigured",
      message: "NEXT_PUBLIC_PRIVY_APP_ID no está configurada. Necesaria para login y wallets.",
      required: true,
    };
  }
  return {
    name: "Privy (auth)",
    status: "ok",
    message: "App ID configurada (login y wallets)",
    required: true,
  };
}

async function checkNearRpc(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const res = await fetch(NEAR_RPC_URL, {
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
        message: `${NEAR_NETWORK} — nodo accesible`,
        latencyMs,
        required: true,
      };
    }
    return {
      name: "NEAR RPC",
      status: "error",
      message: data.error?.message ?? `RPC respondió sin sync_info: ${res.status}`,
      latencyMs,
      required: true,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error de conexión";
    return {
      name: "NEAR RPC",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: true,
    };
  }
}

async function checkNearFunding(): Promise<CheckResult> {
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
    };
  }
  if (hasExternalTestnet) {
    return {
      name: "NEAR funding (faucet)",
      status: "ok",
      message: "Faucet externo configurado (NEAR_TESTNET_FAUCET_API_URL)",
      required: false,
    };
  }
  return {
    name: "NEAR funding (faucet)",
    status: "unconfigured",
    message:
      "Configura NEAR_FAUCET_ACCOUNT_ID y NEAR_FAUCET_PRIVATE_KEY, o (solo testnet) NEAR_TESTNET_FAUCET_API_URL para que los usuarios puedan activar su cuenta.",
    required: false,
  };
}

async function checkNearRelay(): Promise<CheckResult> {
  const relayerAccountId = process.env.NEAR_RELAYER_ACCOUNT_ID ?? process.env.NEXT_PUBLIC_NEAR_RELAYER_ACCOUNT_ID;
  const relayerPrivateKey = process.env.NEAR_RELAYER_PRIVATE_KEY;
  if (!relayerAccountId || !relayerPrivateKey) {
    return {
      name: "NEAR relay (withdraw)",
      status: "unconfigured",
      message: "NEAR_RELAYER_ACCOUNT_ID y NEAR_RELAYER_PRIVATE_KEY necesarios para retiros USDT",
      required: false,
    };
  }
  return {
    name: "NEAR relay (withdraw)",
    status: "ok",
    message: "Relayer configurado para retiros",
    required: false,
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
  if (!key) {
    return {
      name: serviceName,
      status: "unconfigured",
      message: "LLAMA_CLOUD_API_KEY no está configurada (análisis de PDFs)",
      required: true,
    };
  }
  try {
    const form = new FormData();
    form.append("file", new Blob([MINIMAL_PDF], { type: "application/pdf" }), "status-check.pdf");
    const res = await fetch(`${LLAMA_API_URL}/upload`, {
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
      };
    }
    return {
      name: serviceName,
      status: "error",
      message: `Error ${res.status} desde LlamaParse: ${detail}`,
      latencyMs,
      required: true,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return {
      name: serviceName,
      status: "error",
      message: `No se pudo conectar con LlamaParse (¿firewall/red en producción?): ${msg}`,
      latencyMs: Date.now() - start,
      required: true,
    };
  }
}

async function checkNearAI(): Promise<CheckResult> {
  const start = Date.now();
  const key = process.env.NEAR_AI_API_KEY;
  if (!key) {
    return {
      name: "NEAR AI",
      status: "unconfigured",
      message: "NEAR_AI_API_KEY no está configurada (análisis con IA)",
      required: true,
    };
  }
  try {
    const res = await fetch("https://cloud-api.near.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
      }),
    });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        name: "NEAR AI",
        status: "ok",
        message: "API key válida, servicio disponible",
        latencyMs,
        required: true,
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
      };
    }
    return {
      name: "NEAR AI",
      status: "error",
      message: `${res.status}: ${detail}`,
      latencyMs,
      required: true,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error de conexión";
    return {
      name: "NEAR AI",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: true,
    };
  }
}

function checkCloudinary(): CheckResult {
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
    };
  }
  return {
    name: "Cloudinary",
    status: "unconfigured",
    message:
      "CLOUDINARY_URL o (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) para subir fotos y documentos de especialistas",
    required: false,
  };
}

async function checkSpecialistVerificationApi(): Promise<CheckResult> {
  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return {
      name: "API verificación especialistas",
      status: "unconfigured",
      message: "SPECIALIST_VERIFICATION_API_URL no configurada. Marketplace y perfiles de especialistas usan la API interna si no está definida.",
      required: false,
    };
  }
  const start = Date.now();
  try {
    // Solo comprobamos que el origen responda (GET al base URL o /api/status si existe)
    const res = await fetch(`${baseUrl}/api/status`, { method: "GET" });
    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        name: "API verificación especialistas",
        status: "ok",
        message: "Servicio externo accesible",
        latencyMs,
        required: false,
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
      };
    }
    return {
      name: "API verificación especialistas",
      status: "error",
      message: `${res.status} — el endpoint externo no respondió correctamente`,
      latencyMs,
      required: false,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error de conexión";
    return {
      name: "API verificación especialistas",
      status: "error",
      message: msg,
      latencyMs: Date.now() - start,
      required: false,
    };
  }
}

export async function GET() {
  const [
    mongo,
    privy,
    nearRpc,
    nearFunding,
    nearRelay,
    llama,
    nearAI,
    cloudinary,
    specialistApi,
  ] = await Promise.all([
    checkMongoDB(),
    checkPrivy(),
    checkNearRpc(),
    checkNearFunding(),
    checkNearRelay(),
    checkLlamaCloud(),
    checkNearAI(),
    Promise.resolve(checkCloudinary()),
    checkSpecialistVerificationApi(),
  ]);

  const checks = [mongo, privy, nearRpc, nearFunding, nearRelay, llama, nearAI, cloudinary, specialistApi];
  const requiredChecks = checks.filter((c) => c.required !== false);
  const optionalChecks = checks.filter((c) => c.required === false);
  const allRequiredOk = requiredChecks.every((c) => c.status === "ok");
  const anyRequiredError = requiredChecks.some((c) => c.status === "error");
  const anyRequiredUnconfigured = requiredChecks.some((c) => c.status === "unconfigured");
  const anyUnconfigured = checks.some((c) => c.status === "unconfigured");

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (anyRequiredError) status = "unhealthy";
  else if (!allRequiredOk || anyRequiredUnconfigured) status = "degraded";
  else if (anyUnconfigured) status = "degraded";

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    services: checks,
  });
}
