/**
 * Escrow utilities: calculate platform fee (15%) and specialist amount (85%).
 * All amounts are in raw USDT (6 decimals).
 */

/** Platform fee percentage (15%). */
export const PLATFORM_FEE_PERCENTAGE = 15;

/** Specialist receives 85% of the total amount. */
export const SPECIALIST_PERCENTAGE = 100 - PLATFORM_FEE_PERCENTAGE;

/**
 * Calculate platform fee (15%) from total amount.
 * @param amountRaw Total amount in raw USDT (6 decimals, e.g. "10000000" = 10 USDT)
 * @returns Platform fee in raw USDT (e.g. "1500000" = 1.5 USDT)
 */
export function calculatePlatformFee(amountRaw: string): string {
  const total = BigInt(amountRaw);
  const fee = (total * BigInt(PLATFORM_FEE_PERCENTAGE)) / BigInt(100);
  return fee.toString();
}

/**
 * Calculate specialist amount (85%) from total amount.
 * @param amountRaw Total amount in raw USDT (6 decimals)
 * @returns Specialist amount in raw USDT
 */
export function calculateSpecialistAmount(amountRaw: string): string {
  const total = BigInt(amountRaw);
  const fee = BigInt(calculatePlatformFee(amountRaw));
  const specialistAmount = total - fee;
  return specialistAmount.toString();
}

/**
 * Split amount into platform fee and specialist amount.
 * @param amountRaw Total amount in raw USDT
 * @returns Object with platformFeeRaw and specialistAmountRaw
 */
export function splitEscrowAmount(amountRaw: string): {
  platformFeeRaw: string;
  specialistAmountRaw: string;
} {
  return {
    platformFeeRaw: calculatePlatformFee(amountRaw),
    specialistAmountRaw: calculateSpecialistAmount(amountRaw),
  };
}
