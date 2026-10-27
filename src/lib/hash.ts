import { createHash } from "node:crypto";

export type ProposalHashInput = {
  agentId: string;
  to: string;
  amountZatoshis: number;
  reason: string;
  nonce: string;
};

/** Stable SHA-256 over a fixed key order. The nonce is the proposal id. */
export function hashProposal(input: ProposalHashInput): string {
  const canonical = JSON.stringify({
    v: 1,
    agentId: input.agentId,
    to: input.to,
    amountZatoshis: input.amountZatoshis,
    reason: input.reason,
    nonce: input.nonce,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
