import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { policySchema } from "./schema";

const example = JSON.parse(
  readFileSync(path.join(process.cwd(), "examples/policy.payroll.json"), "utf8"),
) as unknown;

const jsonSchema = JSON.parse(
  readFileSync(path.join(process.cwd(), "examples/policy.schema.json"), "utf8"),
) as { required: string[]; properties: Record<string, unknown> };

describe("policy schema", () => {
  it("accepts the sample payroll policy", () => {
    expect(policySchema.parse(example)).toMatchObject({
      maxPerTxZatoshis: 50_000_000,
      dailyCapZatoshis: 200_000_000,
      cooldownSeconds: 30,
    });
  });

  it("rejects a per-tx cap above the daily cap", () => {
    const result = policySchema.safeParse({
      ...(example as object),
      maxPerTxZatoshis: 300_000_000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = policySchema.safeParse({
      ...(example as object),
      spendingKey: "do-not-put-this-here",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the full unified address returned by zcash-devtool", () => {
    const address = "utest130u9cpp02lvmeyleg7jcnfaeugys9e0xd9akf0f3spkmwvqddw8h4jte2nfls7pdcnhzy5hvrsmwnpk5u829skxs7260h8annts495t68zcx72rd8axc0sj8gej562x0cts7j8yxar3gmwlfchxrx0eaydeq9x8llujjxgjgwfaneljkrc5jrsscj0nfhtusplf99frhhtkuukrndg4";
    const parsed = policySchema.parse({
      ...(example as object),
      recipientAllowlist: [address],
    });
    expect(parsed.recipientAllowlist).toEqual([address]);
  });

  it("matches the published JSON schema required fields", () => {
    const parsed = policySchema.parse(example);
    for (const key of jsonSchema.required) {
      expect(parsed).toHaveProperty(key);
    }
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(jsonSchema.properties).sort());
  });
});
