import type { PolicyContext } from "./engine";
import type { Proposal } from "../types";

export function buildPolicyContext(
  proposals: Proposal[],
  agentId: string,
  now: Date,
): PolicyContext {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = start + 24 * 60 * 60 * 1000;
  const approved = proposals.filter(
    (proposal) =>
      proposal.agentId === agentId &&
      proposal.status === "approved" &&
      proposal.decidedAt !== null,
  );

  let spentTodayZatoshis = 0;
  let lastMs: number | null = null;
  for (const proposal of approved) {
    const decided = Date.parse(proposal.decidedAt as string);
    if (Number.isNaN(decided)) continue;
    if (decided >= start && decided < end) {
      spentTodayZatoshis += proposal.amountZatoshis;
    }
    if (lastMs === null || decided > lastMs) lastMs = decided;
  }

  return {
    now,
    spentTodayZatoshis,
    lastApprovedAt: lastMs === null ? null : new Date(lastMs),
  };
}
