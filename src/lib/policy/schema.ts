import { z } from "zod";

import { UNIFIED_ADDRESS_PATTERN } from "../addresses";

export const unifiedAddressSchema = z
  .string()
  .trim()
  .min(12)
  .max(2048)
  .regex(
    UNIFIED_ADDRESS_PATTERN,
    "Use a lowercase Zcash unified address string: u1… or utest1….",
  );

export const policyObjectSchema = z
  .object({
    maxPerTxZatoshis: z
      .number()
      .int()
      .positive()
      .describe("Maximum zatoshis allowed in a single spend."),
    dailyCapZatoshis: z
      .number()
      .int()
      .positive()
      .describe("Maximum zatoshis approved spends may total in one UTC day."),
    recipientAllowlist: z
      .array(unifiedAddressSchema)
      .max(64)
      .describe(
        "Unified addresses this agent may pay. An empty list rejects every recipient.",
      ),
    cooldownSeconds: z.number().int().min(0).max(60 * 60 * 24 * 30),
    sessionExpiresAt: z
      .string()
      .datetime({ offset: true })
      .describe("ISO-8601 instant after which new spends are rejected."),
  })
  .strict();

export const policySchema = policyObjectSchema.superRefine((policy, ctx) => {
  if (policy.maxPerTxZatoshis > policy.dailyCapZatoshis) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxPerTxZatoshis"],
      message: "maxPerTxZatoshis cannot exceed dailyCapZatoshis",
    });
  }
  const unique = new Set(policy.recipientAllowlist);
  if (unique.size !== policy.recipientAllowlist.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recipientAllowlist"],
      message: "recipientAllowlist cannot contain duplicates",
    });
  }
});

export type Policy = z.infer<typeof policySchema>;

export function defaultPolicy(now = new Date()): Policy {
  return {
    maxPerTxZatoshis: 50_000_000,
    dailyCapZatoshis: 200_000_000,
    recipientAllowlist: [],
    cooldownSeconds: 60,
    sessionExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}
