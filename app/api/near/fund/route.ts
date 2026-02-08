import { NextRequest, NextResponse } from "next/server";
import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import type { KeyPairString } from "@near-js/crypto";
import { NEAR_RPC_URL, MIN_NEAR_TO_CREATE_IMPLICIT } from "@/lib/near-config";

/** 0.002 NEAR in yoctoNEAR (1 NEAR = 1e24 yoctoNEAR) */
const FUND_AMOUNT_YOCTO = BigInt(Math.round(parseFloat(MIN_NEAR_TO_CREATE_IMPLICIT) * 1e24));

/**
 * POST /api/near/fund
 * Body: { accountId: string } — the NEAR implicit account to fund (64 hex chars).
 * Uses NEAR_FAUCET_ACCOUNT_ID and NEAR_FAUCET_PRIVATE_KEY from env to send minimal NEAR
 * so the account exists on-chain. No auth required if you restrict by rate / IP in production.
 */
export async function POST(request: NextRequest) {
  const faucetAccountId = process.env.NEAR_FAUCET_ACCOUNT_ID;
  const faucetPrivateKey = process.env.NEAR_FAUCET_PRIVATE_KEY;

  if (!faucetAccountId || !faucetPrivateKey) {
    return NextResponse.json(
      { error: "NEAR faucet not configured. Set NEAR_FAUCET_ACCOUNT_ID and NEAR_FAUCET_PRIVATE_KEY." },
      { status: 503 }
    );
  }

  let body: { accountId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountId = typeof body?.accountId === "string" ? body.accountId.trim() : "";
  if (!accountId) {
    return NextResponse.json({ error: "Missing accountId in body" }, { status: 400 });
  }

  // Implicit account IDs are 64 hex chars (lowercase)
  if (!/^[a-f0-9]{64}$/.test(accountId)) {
    return NextResponse.json(
      { error: "accountId must be a 64-character hex string (implicit account)" },
      { status: 400 }
    );
  }

  try {
    const signer = KeyPairSigner.fromSecretKey(faucetPrivateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const faucetAccount = new Account(faucetAccountId, provider, signer);

    const result = await faucetAccount.sendMoney(accountId, FUND_AMOUNT_YOCTO);
    const txHash =
      typeof result?.transaction_outcome?.id === "string"
        ? result.transaction_outcome.id
        : undefined;

    return NextResponse.json({
      success: true,
      txHash,
      accountId,
      amount: MIN_NEAR_TO_CREATE_IMPLICIT,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[near/fund]", message, e);
    return NextResponse.json(
      { error: "Funding failed", details: message },
      { status: 500 }
    );
  }
}
