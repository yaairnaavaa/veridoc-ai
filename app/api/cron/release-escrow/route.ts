import { NextRequest, NextResponse } from "next/server";
import { Account } from "@near-js/accounts";
import { JsonRpcProvider } from "@near-js/providers";
import { KeyPairSigner } from "@near-js/signers";
import type { KeyPairString } from "@near-js/crypto";
import { NEAR_RPC_URL, ESCROW_ACCOUNT_ID, PLATFORM_FEE_ACCOUNT_ID, isValidNearAccountId } from "@/lib/near-config";
import { USDT_CONTRACT_ID, createTransferUsdtAction, hasStorageDeposit, createStorageDepositAction } from "@/lib/near-usdt";
import { splitEscrowAmount } from "@/lib/escrow";

/**
 * POST /api/cron/release-escrow
 * 
 * Cron job endpoint to release escrow payments 24h after delivery.
 * Protected by CRON_SECRET header.
 * 
 * Finds consultations where:
 * - delivered_at is set
 * - released_at is null
 * - release_after_at <= now
 * 
 * For each, transfers 85% to specialist and 15% to platform fee account.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 }
    );
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "SPECIALIST_VERIFICATION_API_URL not set" },
      { status: 503 }
    );
  }

  const escrowPrivateKey = process.env.ESCROW_PRIVATE_KEY;
  if (!escrowPrivateKey) {
    return NextResponse.json(
      { error: "ESCROW_PRIVATE_KEY not set" },
      { status: 503 }
    );
  }

  try {
    // Fetch consultations ready for release
    const url = `${baseUrl.replace(/\/$/, "")}/api/consultations/pending-release`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: `Failed to fetch pending consultations: ${res.status}`,
          details: error.message,
        },
        { status: res.status }
      );
    }

    const result = await res.json();
    const consultations = result.data || [];

    if (consultations.length === 0) {
      return NextResponse.json({
        success: true,
        released: 0,
        message: "No consultations ready for release",
      });
    }

    // Setup escrow account signer
    const signer = KeyPairSigner.fromSecretKey(escrowPrivateKey as KeyPairString);
    const provider = new JsonRpcProvider({ url: NEAR_RPC_URL });
    const escrowAccount = new Account(ESCROW_ACCOUNT_ID, provider, signer);

    const released: Array<{ consultationId: string; txHash: string }> = [];
    const errors: Array<{ consultationId: string; error: string }> = [];

    // Process each consultation (support both snake_case and camelCase from backend)
    for (const consultation of consultations) {
      const consultationId = consultation._id ?? consultation.id;
      const amountRaw =
        consultation.amount_raw ?? consultation.amountRaw;
      const specialistAccount =
        consultation.specialistAccount ?? consultation.specialist_account;
      const specialistAmountRaw =
        consultation.specialist_amount_raw ?? consultation.specialistAmountRaw;
      const platformFeeRaw =
        consultation.platform_fee_raw ?? consultation.platformFeeRaw;

      if (!consultationId || !amountRaw || !specialistAccount) {
        errors.push({
          consultationId: consultationId ?? "unknown",
          error: "Missing consultation id, amount_raw or specialistAccount",
        });
        continue;
      }

      if (!isValidNearAccountId(specialistAccount)) {
        errors.push({
          consultationId,
          error: `specialistAccount "${specialistAccount}" is not a valid NEAR account (use specialist's nearAddress, not internal id)`,
        });
        continue;
      }

      // Calculate amounts if not already calculated
      const { specialistAmountRaw: calculatedSpecialist, platformFeeRaw: calculatedFee } =
        splitEscrowAmount(amountRaw);
      const finalSpecialistAmount = specialistAmountRaw || calculatedSpecialist;
      const finalPlatformFee = platformFeeRaw || calculatedFee;

      try {
        // Ensure specialist account has storage (NEP-145)
        const hasStorage = await hasStorageDeposit(specialistAccount);
        if (!hasStorage) {
          await escrowAccount.signAndSendTransaction({
            receiverId: USDT_CONTRACT_ID,
            actions: [createStorageDepositAction(specialistAccount)],
          });
        }

        // Transfer 85% to specialist
        const specialistTx = await escrowAccount.signAndSendTransaction({
          receiverId: USDT_CONTRACT_ID,
          actions: [createTransferUsdtAction(finalSpecialistAmount, specialistAccount)],
        });

        const specialistTxHash =
          typeof specialistTx?.transaction_outcome?.id === "string"
            ? specialistTx.transaction_outcome.id
            : undefined;

        // Transfer 15% to platform fee account
        const platformTx = await escrowAccount.signAndSendTransaction({
          receiverId: USDT_CONTRACT_ID,
          actions: [createTransferUsdtAction(finalPlatformFee, PLATFORM_FEE_ACCOUNT_ID)],
        });

        const platformTxHash =
          typeof platformTx?.transaction_outcome?.id === "string"
            ? platformTx.transaction_outcome.id
            : undefined;

        // Update backend: mark as released
        const updateUrl = `${baseUrl.replace(/\/$/, "")}/api/consultations/${consultationId}/release`;
        const updateRes = await fetch(updateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            releasedAt: new Date().toISOString(),
            releaseTxHash: specialistTxHash || platformTxHash,
            specialistTxHash,
            platformTxHash,
          }),
          cache: "no-store",
        });

        if (!updateRes.ok) {
          const updateError = await updateRes.json().catch(() => ({}));
          errors.push({
            consultationId,
            error: `Backend update failed: ${updateError.message || updateRes.status}`,
          });
          continue;
        }

        released.push({
          consultationId,
          txHash: specialistTxHash || "unknown",
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error(`[cron/release-escrow] Failed to release ${consultationId}:`, message);
        errors.push({
          consultationId,
          error: message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      released: released.length,
      total: consultations.length,
      releasedConsultations: released,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[cron/release-escrow]", message, e);
    return NextResponse.json(
      { error: "Cron job failed", details: message },
      { status: 500 }
    );
  }
}
