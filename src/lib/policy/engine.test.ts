import { describe, expect, it } from "vitest";

import { zecToZatoshis } from "../money";
import { evaluatePolicy, type PolicyContext } from "./engine";
import type { Policy } from "./schema";

const NOW = new Date("2026-10-27T12:00:00.000Z");
const RECIPIENT = "utest130u9cpp02lvmeyleg7jcnfaeugys9e0xd9akf0f3spkmwvqddw8h4jte2nfls7pdcnhzy5hvrsmwnpk5u829skxs7260h8annts495t68zcx72rd8axc0sj8gej562x0cts7j8yxar3gmwlfchxrx0eaydeq9x8llujjxgjgwfaneljkrc5jrsscj0nfhtusplf99frhhtkuukrndg4";

const policy: Policy = {
  maxPerTxZatoshis: zecToZatoshis("0.5"),
  dailyCapZatoshis: zecToZatoshis("2"),
  recipientAllowlist: [RECIPIENT],
  cooldownSeconds: 60,
  sessionExpiresAt: "2026-10-28T12:00:00.000Z",
};

function ctx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    now: NOW,
    spentTodayZatoshis: 0,
    lastApprovedAt: null,
    ...overrides,
  };
}

function codes(to: string, zec: string, context = ctx(), activePolicy = policy) {
  const decision = evaluatePolicy(
    activePolicy,
    { to, amountZatoshis: zecToZatoshis(zec) },
    context,
  );
  return decision.allowed ? [] : decision.violations.map((item) => item.code);
}

describe("evaluatePolicy", () => {
  it("allows an in-policy spend", () => {
    expect(codes(RECIPIENT, "0.25")).toEqual([]);
  });

  it("allows an amount that lands exactly on the per-tx and daily caps", () => {
    expect(codes(RECIPIENT, "0.5")).toEqual([]);
    expect(
      codes(RECIPIENT, "0.5", ctx({ spentTodayZatoshis: zecToZatoshis("1.5") })),
    ).toEqual([]);
  });

  it("rejects an over-cap payment with both per-tx and daily violations", () => {
    expect(codes(RECIPIENT, "10")).toEqual(["over_max_per_tx", "over_daily_cap"]);
  });

  it("rejects one zatoshis over the daily cap without a per-tx violation", () => {
    const decision = evaluatePolicy(
      policy,
      { to: RECIPIENT, amountZatoshis: zecToZatoshis("0.5") + 1 },
      ctx({ spentTodayZatoshis: zecToZatoshis("1.5") }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.violations.map((item) => item.code)).toEqual([
        "over_max_per_tx",
        "over_daily_cap",
      ]);
    }

    const onlyDaily = evaluatePolicy(
      policy,
      { to: RECIPIENT, amountZatoshis: zecToZatoshis("0.5") },
      ctx({ spentTodayZatoshis: zecToZatoshis("1.5") + 1 }),
    );
    expect(onlyDaily.allowed).toBe(false);
    if (!onlyDaily.allowed) {
      expect(onlyDaily.violations.map((item) => item.code)).toEqual(["over_daily_cap"]);
    }
  });

  it("rejects a recipient that is not allowlisted", () => {
    expect(codes(RECIPIENT, "0.1", ctx(), { ...policy, recipientAllowlist: [] })).toEqual([
      "recipient_not_allowlisted",
    ]);
  });

  it("rejects every recipient when the allowlist is empty", () => {
    const decision = evaluatePolicy(
      { ...policy, recipientAllowlist: [] },
      { to: RECIPIENT, amountZatoshis: zecToZatoshis("0.1") },
      ctx(),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.violations.map((item) => item.code)).toEqual([
        "recipient_not_allowlisted",
      ]);
    }
  });

  it("rejects a malformed recipient", () => {
    const decision = evaluatePolicy(
      policy,
      { to: "alice@example.com", amountZatoshis: zecToZatoshis("0.1") },
      ctx(),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.violations.map((item) => item.code)).toContain("invalid_recipient");
    }
  });

  it("enforces the cooldown and allows a spend once it has elapsed", () => {
    expect(
      codes(
        RECIPIENT,
        "0.1",
        ctx({ lastApprovedAt: new Date(NOW.getTime() - 59_999) }),
      ),
    ).toEqual(["cooldown_active"]);

    expect(
      codes(
        RECIPIENT,
        "0.1",
        ctx({ lastApprovedAt: new Date(NOW.getTime() - 60_000) }),
      ),
    ).toEqual([]);
  });

  it("treats a zero cooldown as no wait", () => {
    const decision = evaluatePolicy(
      { ...policy, cooldownSeconds: 0 },
      { to: RECIPIENT, amountZatoshis: zecToZatoshis("0.1") },
      ctx({ lastApprovedAt: new Date(NOW.getTime() - 1) }),
    );
    expect(decision.allowed).toBe(true);
  });

  it("rejects an expired session and allows the exact expiry instant", () => {
    const expired = evaluatePolicy(policy, { to: RECIPIENT, amountZatoshis: 1 }, {
      ...ctx(),
      now: new Date("2026-10-28T12:00:00.001Z"),
    });
    expect(expired.allowed).toBe(false);
    if (!expired.allowed) {
      expect(expired.violations.map((item) => item.code)).toContain("session_expired");
    }

    const exact = evaluatePolicy(policy, { to: RECIPIENT, amountZatoshis: 1 }, {
      ...ctx(),
      now: new Date("2026-10-28T12:00:00.000Z"),
    });
    expect(exact.allowed).toBe(true);
  });

  it("rejects non-positive amounts", () => {
    for (const amount of [0, -1]) {
      const decision = evaluatePolicy(
        policy,
        { to: RECIPIENT, amountZatoshis: amount },
        ctx(),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.violations.map((item) => item.code)).toContain(
          "amount_not_positive",
        );
      }
    }
  });

  it("returns every violation together", () => {
    const decision = evaluatePolicy(
      { ...policy, recipientAllowlist: [], sessionExpiresAt: "2026-10-27T11:00:00.000Z" },
      { to: RECIPIENT, amountZatoshis: zecToZatoshis("10") },
      ctx({ lastApprovedAt: new Date(NOW.getTime() - 1_000) }),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.violations.map((item) => item.code)).toEqual([
        "over_max_per_tx",
        "over_daily_cap",
        "recipient_not_allowlisted",
        "cooldown_active",
        "session_expired",
      ]);
    }
  });
});
