import { randomUUID } from "node:crypto";
import { z } from "zod";

import { draftProposal } from "./ai/proposer";
import { isUnifiedAddress } from "./addresses";
import { AgentError } from "./errors";
import { hashProposal } from "./hash";
import { formatZec, zecToZatoshis } from "./money";
import { buildPolicyContext } from "./policy/context";
import { evaluatePolicy } from "./policy/engine";
import { defaultPolicy, policySchema } from "./policy/schema";
import type { AgentStore } from "./store/types";
import type {
  Agent,
  AgentAccount,
  AppState,
  AuditEvent,
  BankAccount,
  Payee,
  PolicyViolation,
  Proposal,
  ProposalSource,
  SpendIntent,
  StoreData,
} from "./types";
import { DevtoolWallet, type DevtoolTransaction } from "./wallet/devtool";

const displayNameSchema = z.string().trim().min(1, "Name is required").max(48);
const payeeNameSchema = z.string().trim().min(1, "Payee name is required").max(64);
const MAX_PAYMENT_ZATOSHIS = 21_000_000 * 100_000_000;

function requireAgent(draft: StoreData, agentId: string): Agent {
  const agent = draft.agents.find((item) => item.id === agentId);
  if (!agent) throw new AgentError("Agent account not found", 404);
  return agent;
}

function requireAccount(draft: StoreData, accountId: string): {
  uuid: string;
  address: string;
  displayName: string;
} {
  if (accountId === "treasury" && draft.treasuryAccountUuid && draft.treasuryAddress) {
    return {
      uuid: draft.treasuryAccountUuid,
      address: draft.treasuryAddress,
      displayName: "Treasury",
    };
  }
  const agent = draft.agents.find((item) => item.id === accountId);
  if (!agent) throw new AgentError("Account not found", 404);
  return {
    uuid: agent.accountUuid,
    address: agent.unifiedAddress,
    displayName: agent.displayName,
  };
}

function pushAudit(
  draft: StoreData,
  event: Omit<AuditEvent, "id" | "timestamp"> & { timestamp: string },
): void {
  draft.audit.push({ id: randomUUID(), ...event });
}

function addIntent(
  draft: StoreData,
  input: Omit<SpendIntent, "id" | "createdAt">,
  timestamp: string,
): SpendIntent {
  const intent = { id: randomUUID(), createdAt: timestamp, ...input };
  draft.intents.push(intent);
  return intent;
}

function dueSync(lastSyncAt: string | null): boolean {
  return !lastSyncAt || Date.now() - Date.parse(lastSyncAt) >= 30_000;
}

function assertPayeeAllowlist(
  policy: ReturnType<typeof policySchema.parse>,
  payees: Payee[],
): void {
  const knownAddresses = new Set(payees.map((payee) => payee.unifiedAddress));
  if (policy.recipientAllowlist.some((address) => !knownAddresses.has(address))) {
    throw new AgentError("Mandate recipients must be selected from the payee book.", 400);
  }
}

export function parseAmountInput(input: {
  amountZec?: string;
  amountZatoshis?: number;
}): number {
  if (input.amountZec !== undefined) return zecToZatoshis(input.amountZec);
  if (input.amountZatoshis !== undefined && Number.isSafeInteger(input.amountZatoshis)) {
    return input.amountZatoshis;
  }
  throw new AgentError("Provide amountZec or a whole-number amountZatoshis.", 400);
}

export class AgentService {
  private syncInFlight: Promise<void> | null = null;
  private approvalQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: AgentStore,
    private readonly wallet: DevtoolWallet,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  async snapshot(): Promise<AppState> {
    let data = await this.store.read();
    const wallet = await this.wallet.status();
    let message = wallet.message;
    if (data.treasuryAccountUuid && wallet.ready && dueSync(data.lastSyncAt)) {
      try {
        await this.sync();
        data = await this.store.read();
      } catch (error) {
        message = error instanceof Error ? error.message : "Could not sync the Zcash wallet.";
      }
    }
    const treasury: BankAccount | null = data.treasuryAccountUuid && data.treasuryAddress
      ? {
          id: "treasury",
          accountUuid: data.treasuryAccountUuid,
          displayName: "Treasury",
          unifiedAddress: data.treasuryAddress,
          balance: null,
          createdAt: data.openedAt ?? "",
        }
      : null;
    const refreshedAgents: AgentAccount[] = [];
    if (data.treasuryAccountUuid && wallet.ready) {
      try {
        treasury!.balance = await this.wallet.getBalance(data.treasuryAccountUuid);
      } catch (error) {
        message = error instanceof Error ? error.message : "Could not read the Treasury balance.";
      }
      for (const agent of data.agents) {
        try {
          refreshedAgents.push({
            ...agent,
            balance: await this.wallet.getBalance(agent.accountUuid),
          });
        } catch (error) {
          message = error instanceof Error ? error.message : "Could not read an account balance.";
          refreshedAgents.push({
            ...agent,
            balance: null,
          });
        }
      }
    } else {
      refreshedAgents.push(...data.agents.map((agent) => ({
        ...agent,
        balance: null,
      })));
    }
    return {
      wallet: {
        ...wallet,
        message,
        openaiConfigured: Boolean(this.env.OPENAI_API_KEY?.trim()),
        lastSyncAt: data.lastSyncAt,
        chainHeight: data.chainHeight,
      },
      treasury,
      agents: refreshedAgents,
      proposals: data.proposals,
      intents: data.intents,
      audit: data.audit,
      payees: data.payees,
    };
  }

  async openBank(): Promise<AppState> {
    const existing = await this.store.read();
    if (existing.treasuryAccountUuid) return this.snapshot();
    const account = await this.wallet.openBank();
    const address = await this.wallet.getAddress(account.uuid);
    const timestamp = new Date().toISOString();
    await this.store.update((draft) => {
      draft.treasuryAccountUuid = account.uuid;
      draft.treasuryAddress = address;
      draft.openedAt = timestamp;
      pushAudit(draft, {
        agentId: "treasury",
        proposalId: null,
        proposalHash: null,
        decision: "bank_opened",
        timestamp,
        detail: `Opened the bank with Treasury account ${account.uuid}.`,
      });
    });
    return this.snapshot();
  }

  async refresh(): Promise<AppState> {
    await this.sync();
    return this.snapshot();
  }

  private async sync(): Promise<void> {
    if (this.syncInFlight) return this.syncInFlight;
    const data = await this.store.read();
    if (!data.treasuryAccountUuid) throw new AgentError("Open the bank before syncing.", 409);
    if (!dueSync(data.lastSyncAt)) return;
    this.syncInFlight = (async () => {
      await this.wallet.sync();
      const chainHeight = await this.wallet.getChainHeight();
      const timestamp = new Date().toISOString();
      await this.store.update((draft) => {
        draft.lastSyncAt = timestamp;
        draft.chainHeight = chainHeight;
      });
    })();
    try {
      await this.syncInFlight;
    } finally {
      this.syncInFlight = null;
    }
  }

  async createAgent(input: {
    displayName: string;
    roleDescription?: string;
    policy?: unknown;
  }): Promise<Agent> {
    const displayName = displayNameSchema.parse(input.displayName);
    const bank = await this.store.read();
    if (!bank.treasuryAccountUuid) throw new AgentError("Open the bank before adding accounts.", 409);
    const policy = input.policy === undefined
      ? defaultPolicy()
      : policySchema.parse(input.policy);
    assertPayeeAllowlist(policy, bank.payees);
    const account = await this.wallet.generateAccount(displayName);
    const address = await this.wallet.getAddress(account.uuid);
    const timestamp = new Date().toISOString();
    return this.store.update((draft) => {
      if (draft.agents.some((item) => item.accountUuid === account.uuid)) {
        throw new AgentError("This wallet account is already linked.", 409);
      }
      const agent: Agent = {
        id: account.uuid,
        accountUuid: account.uuid,
        displayName,
        roleDescription: input.roleDescription?.trim().slice(0, 500) ?? "",
        unifiedAddress: address,
        policy,
        createdAt: timestamp,
      };
      draft.agents.push(agent);
      pushAudit(draft, {
        agentId: agent.id,
        proposalId: null,
        proposalHash: null,
        decision: "agent_created",
        timestamp,
        detail: `Opened ${displayName} as a separate Zcash account.`,
      });
      return agent;
    });
  }

  async getAgent(agentId: string): Promise<AgentAccount> {
    const agent = requireAgent(await this.store.read(), agentId);
    return { ...agent, balance: await this.wallet.getBalance(agent.accountUuid) };
  }

  async updatePolicy(agentId: string, policyInput: unknown): Promise<Agent> {
    const policy = policySchema.parse(policyInput);
    const timestamp = new Date().toISOString();
    return this.store.update((draft) => {
      assertPayeeAllowlist(policy, draft.payees);
      const agent = requireAgent(draft, agentId);
      agent.policy = policy;
      pushAudit(draft, {
        agentId,
        proposalId: null,
        proposalHash: null,
        decision: "policy_updated",
        timestamp,
        detail: "Owner updated the software-enforced spend mandate.",
      });
      return { ...agent };
    });
  }

  async addPayee(input: { name: string; unifiedAddress: string }): Promise<Payee> {
    const name = payeeNameSchema.parse(input.name);
    const address = input.unifiedAddress.trim();
    if (!isUnifiedAddress(address)) throw new AgentError("Enter a valid Zcash unified address.", 400);
    const timestamp = new Date().toISOString();
    return this.store.update((draft) => {
      if (draft.payees.some((payee) => payee.name.toLowerCase() === name.toLowerCase())) {
        throw new AgentError("A payee with this name already exists.", 409);
      }
      const payee = { id: randomUUID(), name, unifiedAddress: address, createdAt: timestamp };
      draft.payees.push(payee);
      pushAudit(draft, {
        agentId: "treasury",
        proposalId: null,
        proposalHash: null,
        decision: "payee_added",
        timestamp,
        detail: `Added payee ${name}.`,
      });
      return payee;
    });
  }

  async payees(): Promise<Payee[]> {
    return (await this.store.read()).payees;
  }

  async proposeFromPrompt(agentId: string, prompt: string): Promise<Proposal> {
    const trimmed = prompt.trim();
    if (!trimmed) throw new AgentError("Instruction is required.", 400);
    if (trimmed.length > 2000) throw new AgentError("Instruction is too long.", 400);
    const snapshot = await this.store.read();
    const agent = requireAgent(snapshot, agentId);
    let drafted;
    try {
      drafted = await draftProposal({
        prompt: trimmed,
        policy: agent.policy,
        agentName: agent.displayName,
        payees: snapshot.payees,
        env: this.env,
      });
    } catch (error) {
      if (error instanceof AgentError) throw error;
      throw new AgentError(error instanceof Error ? error.message : "Could not draft a proposal.", 400);
    }
    return this.insertProposal(agentId, {
      to: drafted.to,
      amountZatoshis: drafted.amountZatoshis,
      reason: drafted.reason,
      source: drafted.source,
      prompt: trimmed,
      draftNote: drafted.note,
    });
  }

  async proposeManual(input: {
    agentId: string;
    to: string;
    amountZatoshis: number;
    reason: string;
  }): Promise<Proposal> {
    const reason = input.reason.trim();
    if (!reason) throw new AgentError("A reason is required.", 400);
    if (reason.length > 500) throw new AgentError("Reason is too long.", 400);
    if (!Number.isSafeInteger(input.amountZatoshis)) {
      throw new AgentError("amountZatoshis must be an integer.", 400);
    }
    return this.insertProposal(input.agentId, {
      to: input.to.trim(),
      amountZatoshis: input.amountZatoshis,
      reason,
      source: "manual",
      prompt: null,
      draftNote: null,
    });
  }

  private insertProposal(
    agentId: string,
    input: {
      to: string;
      amountZatoshis: number;
      reason: string;
      source: ProposalSource;
      prompt: string | null;
      draftNote: string | null;
    },
  ): Promise<Proposal> {
    const now = new Date();
    return this.store.update((draft) => {
      const agent = requireAgent(draft, agentId);
      const id = randomUUID();
      const proposalHash = hashProposal({
        agentId,
        to: input.to,
        amountZatoshis: input.amountZatoshis,
        reason: input.reason,
        nonce: id,
      });
      const decision = evaluatePolicy(
        agent.policy,
        { to: input.to, amountZatoshis: input.amountZatoshis },
        buildPolicyContext(draft.proposals, agentId, now),
      );
      const violations = decision.allowed ? [] : decision.violations;
      const timestamp = now.toISOString();
      const proposal: Proposal = {
        id,
        agentId,
        to: input.to,
        amountZatoshis: input.amountZatoshis,
        reason: input.reason,
        source: input.source,
        prompt: input.prompt,
        draftNote: input.draftNote,
        proposalHash,
        status: violations.length ? "blocked" : "pending",
        violations,
        createdAt: timestamp,
        decidedAt: violations.length ? timestamp : null,
        decisionNote: null,
      };
      draft.proposals.push(proposal);
      pushAudit(draft, {
        agentId,
        proposalId: id,
        proposalHash,
        decision: violations.length ? "blocked" : "proposed",
        timestamp,
        detail: violations.length
          ? `Proposal blocked: ${violations.map((item) => item.code).join(", ")}.`
          : `Proposal created for ${formatZec(input.amountZatoshis)} ZEC.`,
      });
      return proposal;
    });
  }

  approve(proposalId: string, note?: string): Promise<Proposal> {
    const run = this.approvalQueue.then(
      () => this.approveOnce(proposalId, note),
      () => this.approveOnce(proposalId, note),
    );
    this.approvalQueue = run.then(() => undefined, () => undefined);
    return run;
  }

  private async approveOnce(proposalId: string, note?: string): Promise<Proposal> {
    const data = await this.store.read();
    const proposal = data.proposals.find((item) => item.id === proposalId);
    if (!proposal) throw new AgentError("Proposal not found", 404);
    if (proposal.status !== "pending") throw new AgentError("Proposal is no longer pending.", 409);
    const agent = requireAgent(data, proposal.agentId);
    const now = new Date();
    const decision = evaluatePolicy(
      agent.policy,
      { to: proposal.to, amountZatoshis: proposal.amountZatoshis },
      buildPolicyContext(data.proposals, agent.id, now),
    );
    if (!decision.allowed) {
      return this.denyApproval(proposal, decision.violations, now.toISOString());
    }
    const balance = await this.wallet.getBalance(agent.accountUuid);
    let fee: number;
    try {
      fee = await this.wallet.estimateFee(agent.accountUuid, proposal.to, proposal.amountZatoshis);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not estimate the transaction fee.";
      if (/insufficient|spendable|not enough/i.test(message)) {
        return this.denyApproval(proposal, [{
          code: "insufficient_balance",
          message: `Insufficient spendable balance; notes may need confirmations. Spendable: ${formatZec(balance.spendableZatoshis)} ZEC.`,
        }], new Date().toISOString());
      }
      throw error;
    }
    if (balance.spendableZatoshis < proposal.amountZatoshis + fee) {
      return this.denyApproval(proposal, [{
        code: "insufficient_balance",
        message: `Insufficient spendable balance for amount and ${formatZec(fee)} ZEC fee. Spendable: ${formatZec(balance.spendableZatoshis)} ZEC; notes may need confirmations.`,
      }], new Date().toISOString());
    }
    const txid = await this.wallet.send(
      agent.accountUuid,
      proposal.to,
      proposal.amountZatoshis,
      proposal.reason,
    );
    const timestamp = new Date().toISOString();
    return this.store.update((draft) => {
      const current = draft.proposals.find((item) => item.id === proposalId);
      if (!current || current.status !== "pending") {
        throw new AgentError("Proposal changed after the transaction was broadcast.", 409);
      }
      current.status = "approved";
      current.decidedAt = timestamp;
      current.decisionNote = note?.trim().slice(0, 500) || null;
      addIntent(draft, {
        agentId: agent.id,
        proposalId,
        proposalHash: proposal.proposalHash,
        fromUnifiedAddress: agent.unifiedAddress,
        to: proposal.to,
        amountZatoshis: proposal.amountZatoshis,
        txid,
        network: "testnet",
        adapter: this.wallet.id,
        note: proposal.reason,
      }, timestamp);
      pushAudit(draft, {
        agentId: agent.id,
        proposalId,
        proposalHash: proposal.proposalHash,
        decision: "approved",
        timestamp,
        detail: `Broadcast real testnet transaction ${txid}.`,
      });
      return { ...current };
    });
  }

  private async denyApproval(
    proposal: Proposal,
    violations: PolicyViolation[],
    timestamp: string,
  ): Promise<Proposal> {
    return this.store.update((draft) => {
      const current = draft.proposals.find((item) => item.id === proposal.id);
      if (!current || current.status !== "pending") {
        throw new AgentError("Proposal is no longer pending.", 409);
      }
      current.status = "blocked";
      current.violations = violations;
      current.decidedAt = timestamp;
      pushAudit(draft, {
        agentId: current.agentId,
        proposalId: current.id,
        proposalHash: current.proposalHash,
        decision: "approve_denied",
        timestamp,
        detail: `Approval denied: ${violations.map((item) => item.message).join(" ")}`,
      });
      return { ...current };
    });
  }

  async reject(proposalId: string, note?: string): Promise<Proposal> {
    const timestamp = new Date().toISOString();
    return this.store.update((draft) => {
      const proposal = draft.proposals.find((item) => item.id === proposalId);
      if (!proposal) throw new AgentError("Proposal not found", 404);
      if (proposal.status !== "pending") throw new AgentError("Proposal is no longer pending.", 409);
      proposal.status = "rejected";
      proposal.decidedAt = timestamp;
      proposal.decisionNote = note?.trim().slice(0, 500) || null;
      pushAudit(draft, {
        agentId: proposal.agentId,
        proposalId,
        proposalHash: proposal.proposalHash,
        decision: "rejected",
        timestamp,
        detail: proposal.decisionNote || "Owner rejected the proposal.",
      });
      return { ...proposal };
    });
  }

  async fundAgent(agentId: string, amountZatoshis: number): Promise<SpendIntent> {
    if (!Number.isSafeInteger(amountZatoshis) || amountZatoshis <= 0 || amountZatoshis > MAX_PAYMENT_ZATOSHIS) {
      throw new AgentError("Enter a positive whole-atom amount within the ZEC supply.", 400);
    }
    const data = await this.store.read();
    if (!data.treasuryAccountUuid || !data.treasuryAddress) {
      throw new AgentError("Open the bank before transferring from Treasury.", 409);
    }
    const agent = requireAgent(data, agentId);
    const balance = await this.wallet.getBalance(data.treasuryAccountUuid);
    if (balance.spendableZatoshis < amountZatoshis) {
      throw new AgentError("Insufficient spendable Treasury balance; notes may need confirmations.", 409);
    }
    const fee = await this.wallet.estimateFee(data.treasuryAccountUuid, agent.unifiedAddress, amountZatoshis);
    if (balance.spendableZatoshis < amountZatoshis + fee) {
      throw new AgentError("Insufficient spendable Treasury balance; notes may need confirmations.", 409);
    }
    const txid = await this.wallet.send(
      data.treasuryAccountUuid,
      agent.unifiedAddress,
      amountZatoshis,
      `Treasury funding for ${agent.displayName}`,
    );
    const timestamp = new Date().toISOString();
    return this.store.update((draft) => {
      const intent = addIntent(draft, {
        agentId,
        proposalId: null,
        proposalHash: null,
        fromUnifiedAddress: data.treasuryAddress!,
        to: agent.unifiedAddress,
        amountZatoshis,
        txid,
        network: "testnet",
        adapter: this.wallet.id,
        note: `Treasury funding for ${agent.displayName}`,
      }, timestamp);
      pushAudit(draft, {
        agentId,
        proposalId: null,
        proposalHash: null,
        decision: "funded",
        timestamp,
        detail: `Treasury broadcast ${formatZec(amountZatoshis)} ZEC to this account. Txid ${txid}.`,
      });
      return intent;
    });
  }

  async statements(accountId: string): Promise<{
    transactions: DevtoolTransaction[];
    audit: AuditEvent[];
  }> {
    const data = await this.store.read();
    const account = requireAccount(data, accountId);
    const transactions = await this.wallet.getTransactions(account.uuid);
    return {
      transactions,
      audit: data.audit.filter((event) => event.agentId === accountId),
    };
  }

  async revealViewingKey(accountId: string): Promise<string> {
    const account = requireAccount(await this.store.read(), accountId);
    return this.wallet.getViewingKey(account.uuid);
  }

  async audit(agentId?: string | null): Promise<AuditEvent[]> {
    const data = await this.store.read();
    return agentId ? data.audit.filter((event) => event.agentId === agentId) : data.audit;
  }
}
