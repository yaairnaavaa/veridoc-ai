/**
 * NEAR Intents Verifier: balance query and USDT deposit helpers.
 * @see https://docs.near-intents.org/near-intents/market-makers/verifier/deposits-and-withdrawals
 */

import { actionCreators } from "@near-js/transactions";
import { NEAR_RPC_URL, VERIFIER_CONTRACT_ID, USDT_CONTRACT_ID, USDT_TOKEN_ID_IN_VERIFIER } from "./near-config";

function toBase64(str: string): string {
  if (typeof Buffer !== "undefined") return Buffer.from(str, "utf8").toString("base64");
  return btoa(unescape(encodeURIComponent(str)));
}

/** Result of mt_balance_of view call. Balance in smallest units (e.g. for USDT 6 decimals). */
export async function getVerifierBalance(
  accountId: string,
  tokenId: string = USDT_TOKEN_ID_IN_VERIFIER
): Promise<string> {
  const params = {
    request_type: "call_function",
    finality: "final",
    account_id: VERIFIER_CONTRACT_ID,
    method_name: "mt_balance_of",
    args_base64: toBase64(JSON.stringify({ account_id: accountId, token_id: tokenId })),
  };
  const res = await fetch(NEAR_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "veridoc-balance",
      method: "query",
      params,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  const result = data.result;
  if (!result.result || !Array.isArray(result.result)) return "0";
  const bytes = new Uint8Array(result.result);
  const decoded = JSON.parse(new TextDecoder().decode(bytes));
  return String(decoded ?? "0");
}

/** Format USDT balance for display (6 decimals). */
export function formatUsdtBalance(raw: string): string {
  const n = BigInt(raw);
  const div = BigInt(10) ** BigInt(6);
  const int = n / div;
  const frac = (n % div).toString().padStart(6, "0").slice(0, 2);
  return `${int.toLocaleString("en-US")}.${frac}`;
}

/** USDT contract on NEAR (NEP-141). For deposit we use ft_transfer_call to Verifier. */
export { USDT_CONTRACT_ID, VERIFIER_CONTRACT_ID, USDT_TOKEN_ID_IN_VERIFIER };

/** Gas for ft_transfer_call (50 Tgas). Deposit 1 yoctoNEAR per NEP-141. */
const FT_TRANSFER_CALL_GAS = BigInt(50) * BigInt(10) ** BigInt(12);
const FT_TRANSFER_CALL_DEPOSIT = BigInt(1);

/**
 * Build NEP-141 ft_transfer_call args for depositing USDT into NEAR Intents Verifier.
 * @param amountRaw Amount in smallest units (USDT has 6 decimals).
 * @param ownerAccountId NEAR account that will own the balance in the Verifier (usually the sender).
 */
export function buildDepositUsdtArgs(
  amountRaw: string,
  ownerAccountId: string
): { receiver_id: string; amount: string; msg: string } {
  return {
    receiver_id: VERIFIER_CONTRACT_ID,
    amount: amountRaw,
    msg: ownerAccountId,
  };
}

/**
 * Returns the single FunctionCall action to deposit USDT into the Verifier.
 * Use with Account.signAndSendTransaction(USDT_CONTRACT_ID, [action]).
 */
export function createDepositUsdtAction(amountRaw: string, ownerAccountId: string) {
  return actionCreators.functionCall(
    "ft_transfer_call",
    buildDepositUsdtArgs(amountRaw, ownerAccountId),
    FT_TRANSFER_CALL_GAS,
    FT_TRANSFER_CALL_DEPOSIT
  );
}

/** Gas y deposit para ft_withdraw en el Verifier (100 Tgas, 1 yoctoNEAR). */
const FT_WITHDRAW_GAS = BigInt(100) * BigInt(10) ** BigInt(12);
const FT_WITHDRAW_DEPOSIT = BigInt(1);

/**
 * Retirar USDT desde el Verifier a una cuenta NEAR.
 * receiver_id debe ser una cuenta NEAR (para retirar a otras cadenas se usa la app de NEAR Intents).
 * Token en ft_withdraw es sin prefijo nep141.
 */
export function createWithdrawUsdtAction(amountRaw: string, receiverNearAccountId: string) {
  return actionCreators.functionCall(
    "ft_withdraw",
    {
      token: USDT_CONTRACT_ID,
      receiver_id: receiverNearAccountId,
      amount: amountRaw,
    },
    FT_WITHDRAW_GAS,
    FT_WITHDRAW_DEPOSIT
  );
}
