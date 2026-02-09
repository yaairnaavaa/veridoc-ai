import { NextRequest, NextResponse } from "next/server";
import { createRequire } from "module";
import path from "path";
import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import type { KeyPairString } from "@near-js/crypto";
import { actionCreators, SCHEMA, SignedDelegate } from "@near-js/transactions";
import { NEAR_RPC_URL, RELAYER_ACCOUNT_ID } from "@/lib/near-config";
import {
  USDT_CONTRACT_ID,
  hasStorageDeposit,
  createStorageDepositAction,
} from "@/lib/near-usdt";

// Use same borsh as @near-js/transactions (1.0.0: deserialize(schema, buffer)).
// Root "borsh" can be 0.7.0 with different API (schema.get is not a function).
const requireNearBorsh = createRequire(path.join(process.cwd(), "node_modules/@near-js/transactions/package.json"));
const borsh = requireNearBorsh("borsh") as { deserialize(schema: unknown, buffer: Uint8Array): unknown };
function deserializeSignedDelegate(schema: unknown, buffer: Uint8Array): unknown {
  return borsh.deserialize(schema, buffer);
}

/**
 * Decode base64-encoded SignedDelegate (Borsh) into a SignedDelegate instance.
 * We need to reconstruct from deserialized plain object so nested types are correct.
 */
function decodeSignedDelegateBase64(base64: string): SignedDelegate {
  const bytes = Buffer.from(base64, "base64");
  const decoded = deserializeSignedDelegate(SCHEMA.SignedDelegate, new Uint8Array(bytes)) as {
    delegateAction: SignedDelegate["delegateAction"];
    signature: SignedDelegate["signature"];
  };
  return new SignedDelegate(decoded);
}

/** Extract receiver_id from the first ft_transfer action in the delegate (NEP-141 withdraw). */
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
 * POST /api/near/relay-withdraw
 * Body: { signedDelegateBase64: string } — base64 of Borsh-encoded SignedDelegate (user-signed delegate action for USDT ft_transfer).
 * Relayer (veridoc.near) pays gas and submits the transaction. Requires NEAR_RELAYER_ACCOUNT_ID and NEAR_RELAYER_PRIVATE_KEY.
 *
 * NEP-141/145: Si la cuenta de destino no tiene storage en el contrato USDT, el relayer hace antes
 * storage_deposit (paga el relayer) y luego envía el delegate con ft_transfer.
 */
export async function POST(request: NextRequest) {
  const relayerAccountId = process.env.NEAR_RELAYER_ACCOUNT_ID ?? RELAYER_ACCOUNT_ID;
  const relayerPrivateKey = process.env.NEAR_RELAYER_PRIVATE_KEY;

  if (!relayerPrivateKey) {
    return NextResponse.json(
      { error: "Relayer not configured. Set NEAR_RELAYER_PRIVATE_KEY." },
      { status: 503 }
    );
  }

  let body: { signedDelegateBase64?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const signedDelegateBase64 = typeof body?.signedDelegateBase64 === "string" ? body.signedDelegateBase64.trim() : "";
  if (!signedDelegateBase64) {
    return NextResponse.json({ error: "Missing signedDelegateBase64 in body" }, { status: 400 });
  }

  try {
    const signedDelegate = decodeSignedDelegateBase64(signedDelegateBase64);
    // NEP-366: delegate receiverId = contract that executes the actions (e.g. USDT). We whitelist that contract.
    const delegateReceiverId = signedDelegate.delegateAction.receiverId;
    const allowedDelegateReceivers = [USDT_CONTRACT_ID];
    if (!allowedDelegateReceivers.includes(delegateReceiverId)) {
      return NextResponse.json(
        { error: `Delegate receiver must be a whitelisted contract (e.g. ${USDT_CONTRACT_ID})` },
        { status: 400 }
      );
    }

    const signer = KeyPairSigner.fromSecretKey(relayerPrivateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const relayerAccount = new Account(relayerAccountId, provider, signer);

    // NEP-141/145: ensure USDT recipient has storage on the FT contract before ft_transfer
    const usdtReceiverId = getFtTransferReceiverId(signedDelegate.delegateAction);
    if (usdtReceiverId) {
      const hasStorage = await hasStorageDeposit(usdtReceiverId);
      if (!hasStorage) {
        await relayerAccount.signAndSendTransaction({
          receiverId: USDT_CONTRACT_ID,
          actions: [createStorageDepositAction(usdtReceiverId)],
        });
      }
    }

    const delegateAction = actionCreators.signedDelegate({
      delegateAction: signedDelegate.delegateAction,
      signature: signedDelegate.signature,
    });

    // NEP-366: transaction receiver must be the delegate action's sender (the user), not the relayer.
    const delegateSenderId = signedDelegate.delegateAction.senderId;

    const result = await relayerAccount.signAndSendTransaction({
      receiverId: delegateSenderId,
      actions: [delegateAction],
    });

    const txHash =
      typeof result?.transaction_outcome?.id === "string" ? result.transaction_outcome.id : undefined;

    return NextResponse.json({
      success: true,
      txHash,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[near/relay-withdraw]", message, e);
    return NextResponse.json(
      { error: "Relay failed", details: message },
      { status: 500 }
    );
  }
}
