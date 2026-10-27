import { describe, expect, it } from "vitest";

import { parseInstruction } from "./proposer";

const ADDRESS = "utest130u9cpp02lvmeyleg7jcnfaeugys9e0xd9akf0f3spkmwvqddw8h4jte2nfls7pdcnhzy5hvrsmwnpk5u829skxs7260h8annts495t68zcx72rd8axc0sj8gej562x0cts7j8yxar3gmwlfchxrx0eaydeq9x8llujjxgjgwfaneljkrc5jrsscj0nfhtusplf99frhhtkuukrndg4";
const PAYEES = [
  { id: "payee-1", name: "Payroll vendor", unifiedAddress: ADDRESS, createdAt: "" },
];

describe("parseInstruction", () => {
  it("resolves a payee-book name and parses a ZEC amount", () => {
    expect(parseInstruction("Pay 0.25 ZEC to Payroll vendor for the monthly invoice", PAYEES)).toEqual({
      to: ADDRESS,
      amountZatoshis: 25_000_000,
      reason: "Pay 0.25 ZEC to Payroll vendor for the monthly invoice",
    });
  });

  it("parses an integer zatoshi amount", () => {
    expect(parseInstruction("Pay 1200 zatoshis to payroll vendor", PAYEES).amountZatoshis).toBe(1200);
  });

  it("does not resolve names that are missing from the address book", () => {
    expect(() => parseInstruction("Pay 0.1 ZEC to Bob", PAYEES)).toThrow(/address book/i);
  });

  it("does not infer an amount that is absent from the instruction", () => {
    expect(() => parseInstruction("Pay Payroll vendor", PAYEES)).toThrow(/payment amount/i);
  });
});
