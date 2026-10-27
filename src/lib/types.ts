import type { Policy } from "./policy/schema";

export type { Policy };

export type WalletBalance = {
  totalZatoshis: number;
  spendableZatoshis: number;
  chainHeight: number | null;
};

export type Agent = {
  id: string;
  accountUuid: string;
  displayName: string;
  roleDescription: string;
  unifiedAddress: string;
  policy: Policy;
  createdAt: string;
};

export type AgentAccount = Agent & { balance: WalletBalance | null };

export type BankAccount = {
  id: string;
  accountUuid: string;
  displayName: string;
  unifiedAddress: string;
  balance: WalletBalance | null;
  createdAt: string;
};

export type Payee = {
  id: string;
  name: string;
  unifiedAddress: string;
  createdAt: string;
};

export type ProposalStatus = "pending" | "approved" | "rejected" | "blocked";

export type ProposalSource = "parser" | "openai" | "manual";

export type PolicyViolationCode =
  | "amount_not_positive"
  | "over_max_per_tx"
  | "over_daily_cap"
  | "invalid_recipient"
  | "recipient_not_allowlisted"
  | "cooldown_active"
  | "session_expired"
  | "insufficient_balance";

export type PolicyViolation = {
  code: PolicyViolationCode;
  message: string;
};

export type Proposal = {
  id: string;
  agentId: string;
  to: string;
  amountZatoshis: number;
  reason: string;
  source: ProposalSource;
  prompt: string | null;
  /** Set when a model call failed and the deterministic drafter filled in. */
  draftNote: string | null;
  proposalHash: string;
  status: ProposalStatus;
  violations: PolicyViolation[];
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type SpendIntent = {
  id: string;
  agentId: string;
  proposalId: string | null;
  proposalHash: string | null;
  fromUnifiedAddress: string;
  to: string;
  amountZatoshis: number;
  txid: string;
  network: "testnet";
  adapter: string;
  note: string;
  createdAt: string;
};

export type AuditDecision =
  | "agent_created"
  | "funded"
  | "bank_opened"
  | "payee_added"
  | "policy_updated"
  | "proposed"
  | "blocked"
  | "approved"
  | "rejected"
  | "approve_denied";

export type AuditEvent = {
  id: string;
  agentId: string;
  proposalId: string | null;
  proposalHash: string | null;
  decision: AuditDecision;
  timestamp: string;
  detail: string;
};

export type StoreData = {
  treasuryAccountUuid: string | null;
  treasuryAddress: string | null;
  openedAt: string | null;
  lastSyncAt: string | null;
  chainHeight: number | null;
  agents: Agent[];
  proposals: Proposal[];
  intents: SpendIntent[];
  audit: AuditEvent[];
  payees: Payee[];
};

export type AppState = {
  wallet: import("./wallet/devtool").WalletStatus & {
    lastSyncAt: string | null;
    chainHeight: number | null;
  };
  treasury: BankAccount | null;
  agents: AgentAccount[];
  proposals: Proposal[];
  intents: SpendIntent[];
  audit: AuditEvent[];
  payees: Payee[];
};
