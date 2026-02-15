import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";
import path from "path";
import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import type { KeyPairString } from "@near-js/crypto";
import { actionCreators, SCHEMA, SignedDelegate } from "@near-js/transactions";
import { NEAR_RPC_URL, RELAYER_ACCOUNT_ID, ESCROW_ACCOUNT_ID } from "@/lib/near-config";
import {
  USDT_CONTRACT_ID,
  hasStorageDeposit,
  createStorageDepositAction,
} from "@/lib/near-usdt";

// Use same borsh as @near-js/transactions (1.0.0: deserialize(schema, buffer)).
const requireNearBorsh = createRequire(path.join(process.cwd(), "node_modules/@near-js/transactions/package.json"));
const borsh = requireNearBorsh("borsh") as { deserialize(schema: unknown, buffer: Uint8Array): unknown };
function deserializeSignedDelegate(schema: unknown, buffer: Uint8Array): unknown {
  return borsh.deserialize(schema, buffer);
}

/**
 * Decode base64-encoded SignedDelegate (Borsh) into a SignedDelegate instance.
 */
function decodeSignedDelegateBase64(base64: string): SignedDelegate {
  const bytes = Buffer.from(base64, "base64");
  const decoded = deserializeSignedDelegate(SCHEMA.SignedDelegate, new Uint8Array(bytes)) as {
    delegateAction: SignedDelegate["delegateAction"];
    signature: SignedDelegate["signature"];
  };
  return new SignedDelegate(decoded);
}

/** Extract receiver_id from the first ft_transfer action in the delegate. */
function getFtTransferReceiverId(delegateAction: SignedDelegate["delegateAction"]): string | null {
  const actions = (delegateAction as { actions?: unknown[] }).actions;
  if (!Array.isArray(actions)) return null;
  for (const action of actions) {
    const raw = action as Record<string, unknown>;
    const fc = (raw?.functionCall ?? raw?.function_call) as { methodName?: string; method_name?: string; args?: Uint8Array } | undefined;
    if (!fc) continue;
    const method = fc.methodName ?? fc.method_name;
    if (method !== "ft_transfer") continue;
    let argsBytes = fc.args;
    if (!argsBytes) continue;
    if (Array.isArray(argsBytes)) argsBytes = new Uint8Array(argsBytes);
    if (typeof (argsBytes as Uint8Array).length !== "number") continue;
    try {
      const json = new TextDecoder().decode(argsBytes as Uint8Array);
      const args = JSON.parse(json) as { receiver_id?: string };
      if (typeof args?.receiver_id === "string") return args.receiver_id;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Extract memo from the first ft_transfer action in the delegate.
 */
function getFtTransferMemo(delegateAction: SignedDelegate["delegateAction"]): string | null {
  const actions = (delegateAction as { actions?: unknown[] }).actions;
  if (!Array.isArray(actions)) return null;
  for (const action of actions) {
    const raw = action as Record<string, unknown>;
    const fc = (raw?.functionCall ?? raw?.function_call) as { methodName?: string; method_name?: string; args?: Uint8Array } | undefined;
    if (!fc) continue;
    const method = fc.methodName ?? fc.method_name;
    if (method !== "ft_transfer") continue;
    let argsBytes = fc.args;
    if (!argsBytes) continue;
    if (Array.isArray(argsBytes)) argsBytes = new Uint8Array(argsBytes);
    if (typeof (argsBytes as Uint8Array).length !== "number") continue;
    try {
      const json = new TextDecoder().decode(argsBytes as Uint8Array);
      const args = JSON.parse(json) as { memo?: string | null };
      return args?.memo ?? null;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * GET /api/near/relay-escrow-deposit
 * Diagnóstico: indica si las variables necesarias están configuradas (sin mostrar valores).
 * Útil para verificar en producción que el runtime tiene las env vars.
 */
export async function GET() {
  const relayerAccountId = process.env.NEAR_RELAYER_ACCOUNT_ID ?? RELAYER_ACCOUNT_ID;
  const relayerKeySet = Boolean(process.env.NEAR_RELAYER_PRIVATE_KEY);
  const escrowId = ESCROW_ACCOUNT_ID;
  return NextResponse.json({
    ok: true,
    relayerAccountId,
    relayerConfigured: relayerKeySet,
    escrowAccountId: escrowId,
    message: relayerKeySet
      ? "Relay listo para depósitos a escrow."
      : "Falta NEAR_RELAYER_PRIVATE_KEY en el entorno (Hosting → Environment variables y artifact con .env.production).",
  });
}

/**
 * POST /api/near/relay-escrow-deposit
 * Body: { signedDelegateBase64: string }
 *
 * Meta-transaction endpoint for depositing USDT to escrow account.
 * Only allows transfers to ESCROW_ACCOUNT_ID (whitelist).
 * Relayer pays gas; user only signs once.
 */
export async function POST(request: NextRequest) {
  try {
    const relayerAccountId = process.env.NEAR_RELAYER_ACCOUNT_ID ?? RELAYER_ACCOUNT_ID;
    const relayerPrivateKey = process.env.NEAR_RELAYER_PRIVATE_KEY;

    if (!relayerPrivateKey) {
      return NextResponse.json(
        { success: false, error: "Relayer not configured. Set NEAR_RELAYER_PRIVATE_KEY." },
        { status: 503 }
      );
    }

    let body: { signedDelegateBase64?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const signedDelegateBase64 = typeof body?.signedDelegateBase64 === "string" ? body.signedDelegateBase64.trim() : "";
    if (!signedDelegateBase64) {
      return NextResponse.json({ success: false, error: "Missing signedDelegateBase64 in body" }, { status: 400 });
    }
    const signedDelegate = decodeSignedDelegateBase64(signedDelegateBase64);

    // NEP-366: delegate receiverId = contract that executes the actions (USDT)
    const delegateReceiverId = signedDelegate.delegateAction.receiverId;
    if (delegateReceiverId !== USDT_CONTRACT_ID) {
      return NextResponse.json(
        { success: false, error: `Delegate receiver must be ${USDT_CONTRACT_ID}` },
        { status: 400 }
      );
    }

    // CRITICAL: Only allow transfers to escrow account
    const ftTransferReceiverId = getFtTransferReceiverId(signedDelegate.delegateAction);
    if (!ftTransferReceiverId) {
      return NextResponse.json(
        { success: false, error: "No ft_transfer action found in delegate" },
        { status: 400 }
      );
    }

    if (ftTransferReceiverId !== ESCROW_ACCOUNT_ID) {
      return NextResponse.json(
        { success: false, error: `Transfer receiver must be escrow account (${ESCROW_ACCOUNT_ID}), got ${ftTransferReceiverId}` },
        { status: 400 }
      );
    }

    const signer = KeyPairSigner.fromSecretKey(relayerPrivateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const relayerAccount = new Account(relayerAccountId, provider, signer);

    // Ensure escrow account has storage on USDT contract (NEP-145)
    const hasStorage = await hasStorageDeposit(ESCROW_ACCOUNT_ID);
    if (!hasStorage) {
      await relayerAccount.signAndSendTransaction({
        receiverId: USDT_CONTRACT_ID,
        actions: [createStorageDepositAction(ESCROW_ACCOUNT_ID)],
      });
    }

    const delegateAction = actionCreators.signedDelegate({
      delegateAction: signedDelegate.delegateAction,
      signature: signedDelegate.signature,
    });

    // NEP-366: transaction receiver must be the delegate action's sender (the user)
    const delegateSenderId = signedDelegate.delegateAction.senderId;

    const result = await relayerAccount.signAndSendTransaction({
      receiverId: delegateSenderId,
      actions: [delegateAction],
    });

    const txHash =
      typeof result?.transaction_outcome?.id === "string" ? result.transaction_outcome.id : undefined;

    // Verify execution succeeded; receipt failures can still mark status as Failure
    const status = result?.status ?? result?.final_execution_status;
    const isFailure =
      typeof status === "object" &&
      status !== null &&
      "Failure" in status &&
      (status as { Failure?: unknown }).Failure != null;
    if (isFailure) {
      const failure = (status as { Failure?: { ActionError?: { kind?: { ExecutionError?: string }; message?: string } } }).Failure;
      const errMsg =
        failure?.ActionError?.kind?.ExecutionError ??
        failure?.ActionError?.message ??
        (typeof failure === "object" ? JSON.stringify(failure) : "Transaction failed");
      console.error("[near/relay-escrow-deposit] Execution failed:", errMsg);
      return NextResponse.json(
        {
          success: false,
          error: "La transacción no se ejecutó correctamente.",
          details: errMsg,
          txHash,
        },
        { status: 502 }
      );
    }

    // Extract memo if present (may contain consultation_id)
    const memo = getFtTransferMemo(signedDelegate.delegateAction);

    return NextResponse.json({
      success: true,
      txHash,
      memo: memo ?? undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const name = e instanceof Error ? e.name : "Error";
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[near/relay-escrow-deposit]", name, message, e);

    const body: Record<string, unknown> = {
      success: false,
      error: "Relay failed",
      details: message,
      code: name !== "Error" ? name : undefined,
    };
    // Incluir stack si piden diagnóstico (header o query en request)
    const requestUrl = request.url || "";
    const wantsDebug =
      request.headers.get("x-debug") === "1" ||
      request.headers.get("x-diagnose") === "1" ||
      (typeof requestUrl === "string" && requestUrl.includes("diagnose=1"));
    if (wantsDebug && stack) body.stack = stack;

    return NextResponse.json(body, { status: 500 });
  }
}
