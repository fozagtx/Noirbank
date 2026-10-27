import type { Policy } from "./schema";
import type { PolicyViolation, PolicyViolationCode } from "../types";
import { isUnifiedAddress } from "../addresses";

export type PolicyContext = {
  now: Date;
  /** Approved spend amounts since 00:00 UTC, in zatoshis. */
  spentTodayZatoshis: number;
  /** Most recent approved spend, if any. */
  lastApprovedAt: Date | null;
};

export type PolicyDecision =
  | { allowed: true }
  | { allowed: false; violations: PolicyViolation[] };

export type SpendRequest = {
  to: string;
  amountZatoshis: number;
};

function violation(code: PolicyViolationCode, message: string): PolicyViolation {
  return { code, message };
}

/**
 * Pure gate. It does not look at balances or keys. Callers pass the day's
 * already-approved total and the last approval time.
 */
export function evaluatePolicy(
  policy: Policy,
  spend: SpendRequest,
  ctx: PolicyContext,
): PolicyDecision {
  const violations: PolicyViolation[] = [];
  const amountIsPositive =
    Number.isSafeInteger(spend.amountZatoshis) && spend.amountZatoshis > 0;

  if (!amountIsPositive) {
    violations.push(
      violation(
        "amount_not_positive",
        "Amount must be a positive whole number of zatoshis.",
      ),
    );
  }

  if (amountIsPositive && spend.amountZatoshis > policy.maxPerTxZatoshis) {
    violations.push(
      violation(
        "over_max_per_tx",
        `Amount exceeds the per-transaction cap of ${policy.maxPerTxZatoshis} zatoshis.`,
      ),
    );
  }

  if (
    amountIsPositive &&
    ctx.spentTodayZatoshis + spend.amountZatoshis > policy.dailyCapZatoshis
  ) {
    const next = ctx.spentTodayZatoshis + spend.amountZatoshis;
    violations.push(
      violation(
        "over_daily_cap",
        `This spend would bring today's approvals to ${next} zatoshis, above the ${policy.dailyCapZatoshis} zatoshis daily cap.`,
      ),
    );
  }

  const to = spend.to.trim();
  if (!isUnifiedAddress(to)) {
    violations.push(
      violation(
        "invalid_recipient",
        "Recipient must be a lowercase Zcash unified address.",
      ),
    );
  } else if (!policy.recipientAllowlist.includes(to)) {
    violations.push(
      violation(
        "recipient_not_allowlisted",
        "Recipient is not on this agent's allowlist.",
      ),
    );
  }

  if (policy.cooldownSeconds > 0 && ctx.lastApprovedAt) {
    const elapsed = ctx.now.getTime() - ctx.lastApprovedAt.getTime();
    if (elapsed < policy.cooldownSeconds * 1000) {
      violations.push(
        violation(
          "cooldown_active",
          `Cooldown is ${policy.cooldownSeconds}s. Last approval was ${Math.max(0, Math.floor(elapsed / 1000))}s ago.`,
        ),
      );
    }
  }

  const expires = Date.parse(policy.sessionExpiresAt);
  if (Number.isNaN(expires) || ctx.now.getTime() > expires) {
    violations.push(
      violation(
        "session_expired",
        "The owner session on this policy has expired. Save a new expiry to keep spending.",
      ),
    );
  }

  if (violations.length > 0) return { allowed: false, violations };
  return { allowed: true };
}
