"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BookUser,
  Check,
  Copy,
  FileClock,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { ZCASH_TESTNET } from "@/lib/config";
import { formatZec } from "@/lib/money";
import type {
  AgentAccount,
  AppState,
  Payee,
  Policy,
  Proposal,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useBank } from "@/components/banking-shell";

type Section =
  | "overview"
  | "accounts"
  | "account"
  | "approvals"
  | "payees"
  | "statements"
  | "settings";

function Amount({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined
    ? <span className="amount-unavailable">—</span>
    : <>{formatZec(value)} <small>ZEC</small></>;
}

function Surface({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface ${className}`}>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {title && <h2 className="surface-title">{title}</h2>}
      {children}
    </section>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function AccountLine({ agent }: { agent: AgentAccount }) {
  return (
    <Link className="account-line" href={`/app/accounts/${agent.id}`}>
      <span className="account-avatar"><Wallet size={17} /></span>
      <span className="account-line-main">
        <strong>{agent.displayName}</strong>
        <span>{agent.roleDescription || "Agent account"} · {agent.unifiedAddress.slice(0, 13)}…</span>
      </span>
      <span className="account-line-balance">
        <Amount value={agent.balance?.totalZatoshis} />
        <small>CHAIN BALANCE</small>
      </span>
      <ArrowRight className="account-line-arrow" size={17} />
    </Link>
  );
}

function Overview({ state }: { state: AppState }) {
  const { refresh, loading } = useBank();
  const pending = state.proposals.filter((proposal) => proposal.status === "pending");
  const available = state.treasury?.balance?.spendableZatoshis;
  const openApprovals = pending.length;
  return (
    <>
      <PageIntro
        eyebrow="PRIVATE BANKING / ZCASH TESTNET"
        title="Good to see you."
        description="Your Treasury, agent accounts and approvals, live on Zcash testnet."
        action={
          <Button className="nb-button nb-button--outline" disabled={loading} onClick={() => void refresh()}>
            <RefreshCw size={15} /> Refresh from chain
          </Button>
        }
      />
      <div className="overview-grid">
        <Surface className="treasury-card">
          <div className="treasury-top">
            <div>
              <div className="eyebrow">TREASURY · TESTNET</div>
              <h2 className="balance-display">
                <Amount value={state.treasury?.balance?.totalZatoshis} />
              </h2>
              <p className="muted-line">
                Spendable <Amount value={available} />
              </p>
            </div>
            <div className="treasury-icon"><LandmarkIcon /></div>
          </div>
          <div className="treasury-meta">
            <span><span className="status-dot status-dot--green" /> {state.wallet.chainHeight ? `CHAIN HEIGHT ${state.wallet.chainHeight.toLocaleString()}` : "CHAIN HEIGHT —"}</span>
            <span>LAST SYNC {state.wallet.lastSyncAt ? new Date(state.wallet.lastSyncAt).toLocaleTimeString() : "—"}</span>
          </div>
          {state.treasury?.unifiedAddress && (
            <div className="address-strip">
              <span>{state.treasury.unifiedAddress}</span>
              <CopyButton value={state.treasury.unifiedAddress} />
            </div>
          )}
          {state.treasury?.unifiedAddress && <TreasuryReceive address={state.treasury.unifiedAddress} />}
        </Surface>
        <Surface className="approval-highlight">
          <div className="eyebrow">OWNER ACTIONS</div>
          <div className="approval-count">{openApprovals.toString().padStart(2, "0")}</div>
          <h2>{openApprovals === 1 ? "Payment needs your approval" : "Pending approvals"}</h2>
          <p>{openApprovals ? "Nothing broadcasts until you review and approve." : "New agent requests will appear here for review."}</p>
          <Link className="text-link" href="/app/approvals">Review queue <ArrowRight size={15} /></Link>
        </Surface>
      </div>
      <div className="section-heading">
        <div>
          <div className="eyebrow">ACCOUNTS</div>
          <h2>Agent accounts</h2>
        </div>
        <Link className="subtle-link" href="/app/accounts">View all <ArrowRight size={15} /></Link>
      </div>
      <Surface className="account-list-surface">
        {state.agents.length ? state.agents.slice(0, 4).map((agent) => <AccountLine key={agent.id} agent={agent} />) : (
          <div className="empty-state">
            <div className="empty-state-icon"><Wallet size={19} /></div>
            <strong>No agent accounts yet</strong>
            <span>Each account gets its own shielded Zcash address and software mandate.</span>
            <Link className="text-link" href="/app/accounts">Open an account <ArrowRight size={15} /></Link>
          </div>
        )}
      </Surface>
      <div className="overview-lower-grid">
        <Surface title="Latest activity" eyebrow="AUDIT LOG">
          <AuditList events={state.audit.slice(-4).reverse()} />
        </Surface>
        <Surface title="A clear line of control" eyebrow="TRUST MODEL">
          <div className="trust-copy">
            <ShieldCheck size={19} />
            <p>Noirbank checks each agent&apos;s mandate before any payment. Each agent account has its own keys, kept encrypted on your server. Agents request payments; only you approve them.</p>
          </div>
          <Link className="text-link" href="/app/settings">Review bank settings <ArrowRight size={15} /></Link>
        </Surface>
      </div>
    </>
  );
}

function LandmarkIcon() {
  return <Banknote size={22} strokeWidth={1.6} />;
}

function TreasuryReceive({ address }: { address: string }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    void QRCode.toDataURL(address, { width: 132, margin: 1 })
      .then(setQr)
      .catch(() => setQr(null));
  }, [address]);
  return (
    <div className="treasury-receive">
      {qr && <Image src={qr} width={72} height={72} unoptimized alt="Treasury unified address QR code" />}
      <div className="treasury-receive-copy">
        <strong>Fund Treasury on testnet</strong>
        <span>Use this real unified address at a testnet faucet.</span>
        <div>{ZCASH_TESTNET.faucets.map((faucet) => (
          <a key={faucet.url} href={faucet.url} target="_blank" rel="noreferrer">
            {faucet.name} <ArrowUpRight size={12} />
          </a>
        ))}</div>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-button"
      type="button"
      aria-label="Copy address"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {copied && <span>Copied</span>}
    </button>
  );
}

const templates = {
  "Payroll clerk": {
    description: "Prepares scheduled payroll payments for owner review.",
    maxPerTxZatoshis: 50_000_000,
    dailyCapZatoshis: 200_000_000,
    cooldownSeconds: 3600,
    sessionDays: 30,
  },
  "Tips bot": {
    description: "Drafts small community tips to allowlisted recipients.",
    maxPerTxZatoshis: 5_000_000,
    dailyCapZatoshis: 25_000_000,
    cooldownSeconds: 60,
    sessionDays: 7,
  },
  "API spender": {
    description: "Prepares bounded payments for API usage and services.",
    maxPerTxZatoshis: 10_000_000,
    dailyCapZatoshis: 50_000_000,
    cooldownSeconds: 300,
    sessionDays: 7,
  },
} as const;

function Accounts({ state }: { state: AppState }) {
  const { request } = useBank();
  const router = useRouter();
  const [templateName, setTemplateName] = useState<keyof typeof templates>("Payroll clerk");
  const [name, setName] = useState("Payroll clerk");
  const [role, setRole] = useState<string>(templates["Payroll clerk"].description);
  const [selectedPayees, setSelectedPayees] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function selectTemplate(value: keyof typeof templates) {
    setTemplateName(value);
    setName(value);
    setRole(templates[value].description);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    const template = templates[templateName];
    const policy: Policy = {
      maxPerTxZatoshis: template.maxPerTxZatoshis,
      dailyCapZatoshis: template.dailyCapZatoshis,
      recipientAllowlist: selectedPayees,
      cooldownSeconds: template.cooldownSeconds,
      sessionExpiresAt: new Date(Date.now() + template.sessionDays * 86_400_000).toISOString(),
    };
    try {
      const agent = await request<AgentAccount>("/api/agents", {
        displayName: name,
        roleDescription: role,
        policy,
      });
      router.push(`/app/accounts/${agent.id}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageIntro eyebrow="YOUR ACCOUNTS" title="Agents, on their own rails." description="Each agent has a separate Zcash account, a mandate and no ability to approve its own payments." />
      <div className="accounts-layout">
        <div>
          <div className="eyebrow section-overline">OPEN ACCOUNTS</div>
          <Surface className="account-list-surface">
            {state.agents.length ? state.agents.map((agent) => <AccountLine key={agent.id} agent={agent} />) : (
              <div className="empty-state"><div className="empty-state-icon"><Wallet size={19} /></div><strong>Your agent accounts will live here</strong><span>Pick a template to open a shielded agent account.</span></div>
            )}
          </Surface>
          <Surface className="treasury-list-card">
            <div className="account-avatar account-avatar--treasury"><LandmarkIcon /></div>
            <div className="account-line-main"><strong>Treasury</strong><span>Owner-controlled primary account</span></div>
            <span className="label-chip">OWNER</span>
            <Link className="text-link" href="/app/statements?accountId=treasury">Statement <ArrowRight size={15} /></Link>
          </Surface>
        </div>
        <Surface className="open-account-form">
          <div className="eyebrow">OPEN AN AGENT ACCOUNT</div>
          <h2>Start with a mandate.</h2>
          <p className="form-intro">Templates prefill a role and sensible software limits. You can edit every limit before opening the account.</p>
          <form onSubmit={submit}>
            <label className="field-label">START FROM A TEMPLATE</label>
            <div className="template-grid">
              {(Object.keys(templates) as (keyof typeof templates)[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`template-choice ${item === templateName ? "template-choice--selected" : ""}`}
                  onClick={() => selectTemplate(item)}
                >
                  <span>{item}</span><small>{templates[item].description}</small>
                </button>
              ))}
            </div>
            <label className="field-label" htmlFor="agent-name">ACCOUNT NAME</label>
            <input id="agent-name" className="text-field" value={name} onChange={(event) => setName(event.target.value)} required maxLength={48} />
            <label className="field-label" htmlFor="agent-role">ROLE DESCRIPTION</label>
            <textarea id="agent-role" className="text-field text-area" value={role} onChange={(event) => setRole(event.target.value)} maxLength={500} />
            <div className="template-limits">
              <span><small>MAX PER PAYMENT</small><b>{formatZec(templates[templateName].maxPerTxZatoshis)} ZEC</b></span>
              <span><small>DAILY CAP</small><b>{formatZec(templates[templateName].dailyCapZatoshis)} ZEC</b></span>
              <span><small>COOLDOWN</small><b>{templates[templateName].cooldownSeconds}s</b></span>
              <span><small>SESSION</small><b>{templates[templateName].sessionDays} days</b></span>
            </div>
            <label className="field-label">PAYEE ALLOWLIST</label>
            <div className="payee-check-list">
              {state.payees.length ? state.payees.map((payee) => (
                <label className="check-row" key={payee.id}>
                  <input
                    type="checkbox"
                    checked={selectedPayees.includes(payee.unifiedAddress)}
                    onChange={() => setSelectedPayees((values) => values.includes(payee.unifiedAddress)
                      ? values.filter((value) => value !== payee.unifiedAddress)
                      : [...values, payee.unifiedAddress])}
                  />
                  <span>{payee.name}</span><small>{payee.unifiedAddress.slice(0, 15)}…</small>
                </label>
              )) : <div className="inline-empty">Add a payee before allowing an agent to address a payment.</div>}
            </div>
            {formError && <div className="form-error">{formError}</div>}
            <Button type="submit" className="nb-button nb-button--primary nb-button--wide" disabled={busy || !state.wallet.opened}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />} Open account
            </Button>
          </form>
        </Surface>
      </div>
    </>
  );
}

function AccountDetail({ state }: { state: AppState }) {
  const params = useParams<{ id: string }>();
  const agent = state.agents.find((item) => item.id === params.id);
  if (!agent) return <div className="not-found-panel"><h1>Account not found</h1><Link className="text-link" href="/app/accounts">Back to accounts</Link></div>;
  return <AccountDetailView key={agent.id} agent={agent} state={state} />;
}

function AccountDetailView({ agent, state }: { agent: AgentAccount; state: AppState }) {
  const { request } = useBank();
  const [qr, setQr] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(agent.policy);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!agent.unifiedAddress) return;
    void QRCode.toDataURL(agent.unifiedAddress, { width: 200, margin: 1, color: { dark: "#191613", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [agent.unifiedAddress]);

  async function sendInstruction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await request(`/api/agents/${agent.id}/proposals`, { prompt: instruction });
      setInstruction("");
      setMessage("Draft added to approvals. It has not been sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not draft payment.");
    } finally {
      setBusy(false);
    }
  }

  async function transferFromTreasury(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await request(`/api/agents/${agent.id}/fund`, { amountZec: amount });
      setAmount("");
      setMessage("Treasury transfer broadcast to testnet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not transfer from Treasury.");
    } finally {
      setBusy(false);
    }
  }

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!policy) return;
    setBusy(true);
    setMessage(null);
    try {
      await request(`/api/agents/${agent.id}/policy`, policy, "PUT");
      setMessage("Mandate saved. Pending proposals are rechecked at approval.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save mandate.");
    } finally {
      setBusy(false);
    }
  }

  const accountProposals = state.proposals.filter((proposal) => proposal.agentId === agent.id).slice().reverse();
  return (
    <>
      <PageIntro eyebrow="AGENT ACCOUNT / TESTNET" title={agent.displayName} description={agent.roleDescription || "Independent shielded account with an owner-managed mandate."} action={<Link className="nb-button nb-button--outline" href="/app/accounts"><ArrowRight size={15} /> All accounts</Link>} />
      {message && <div className="inline-notice">{message}</div>}
      <div className="account-detail-grid">
        <Surface className="account-balance-card">
          <div className="eyebrow">CHAIN BALANCE</div>
          <h2 className="balance-display"><Amount value={agent.balance?.totalZatoshis} /></h2>
          <div className="spendable-line">Spendable <Amount value={agent.balance?.spendableZatoshis} /></div>
          <div className="address-block">
            <div className="eyebrow">UNIFIED ADDRESS</div>
            <div className="address-value">{agent.unifiedAddress}</div>
            <CopyButton value={agent.unifiedAddress} />
          </div>
          {qr && <div className="qr-frame"><Image src={qr} width={132} height={132} unoptimized alt="QR code for the account's unified address" /></div>}
          <p className="qr-caption">Share this address to receive testnet ZEC.</p>
        </Surface>
        <div className="account-tools-column">
          <Surface eyebrow="INSTRUCT AGENT" title="Draft a payment">
            <p className="muted-copy">Name a payee and an amount. The agent can propose; only you can approve.</p>
            <form className="stack-form" onSubmit={sendInstruction}>
              <textarea className="text-field text-area" placeholder="Pay 0.25 ZEC to a listed payee for…" value={instruction} onChange={(event) => setInstruction(event.target.value)} required maxLength={2000} />
              <Button type="submit" className="nb-button nb-button--primary" disabled={busy || !state.payees.length}>
                {busy ? <LoaderCircle className="spin" size={16} /> : <Send size={15} />} Add to approvals
              </Button>
            </form>
          </Surface>
          <Surface eyebrow="TREASURY TRANSFER" title="Fund this account">
            <p className="muted-copy">Broadcasts a real shielded payment from Treasury to this account.</p>
            <form className="inline-form" onSubmit={transferFromTreasury}>
              <label className="sr-only" htmlFor="fund-amount">Amount in ZEC</label>
              <input id="fund-amount" className="text-field" inputMode="decimal" placeholder="0.00 ZEC" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              <Button type="submit" className="nb-button nb-button--outline" disabled={busy}><ArrowDownToLine size={15} /> Transfer</Button>
            </form>
          </Surface>
        </div>
      </div>
      {policy && (
        <Surface className="mandate-surface">
          <div className="surface-head-row">
            <div><div className="eyebrow">SOFTWARE-ENFORCED LIMITS</div><h2 className="surface-title">Mandate</h2></div>
            <span className="label-chip">NOT A CONSENSUS RULE</span>
          </div>
          <form className="mandate-form" onSubmit={savePolicy}>
            <label className="field-label">MAX / PAYMENT (ZATOSHIS)<input className="text-field" type="number" min="1" value={policy.maxPerTxZatoshis} onChange={(e) => setPolicy({ ...policy, maxPerTxZatoshis: Number(e.target.value) })} /></label>
            <label className="field-label">DAILY CAP (ZATOSHIS)<input className="text-field" type="number" min="1" value={policy.dailyCapZatoshis} onChange={(e) => setPolicy({ ...policy, dailyCapZatoshis: Number(e.target.value) })} /></label>
            <label className="field-label">COOLDOWN (SECONDS)<input className="text-field" type="number" min="0" value={policy.cooldownSeconds} onChange={(e) => setPolicy({ ...policy, cooldownSeconds: Number(e.target.value) })} /></label>
            <label className="field-label">SESSION EXPIRY<input className="text-field" type="datetime-local" value={policy.sessionExpiresAt.slice(0, 16)} onChange={(e) => setPolicy({ ...policy, sessionExpiresAt: new Date(e.target.value).toISOString() })} /></label>
            <div className="field-label allowlist-field">ALLOWLIST · PAYEES
              <div className="payee-check-list mandate-payees">
                {state.payees.length ? state.payees.map((payee) => (
                  <label className="check-row" key={payee.id}>
                    <input type="checkbox" checked={policy.recipientAllowlist.includes(payee.unifiedAddress)} onChange={() => setPolicy({
                      ...policy,
                      recipientAllowlist: policy.recipientAllowlist.includes(payee.unifiedAddress)
                        ? policy.recipientAllowlist.filter((address) => address !== payee.unifiedAddress)
                        : [...policy.recipientAllowlist, payee.unifiedAddress],
                    })} />
                    <span>{payee.name}</span><small>{payee.unifiedAddress.slice(0, 14)}…</small>
                  </label>
                )) : <div className="inline-empty">Add payees before enabling recipients.</div>}
              </div>
            </div>
            <Button type="submit" className="nb-button nb-button--primary" disabled={busy}><Check size={15} /> Save mandate</Button>
          </form>
        </Surface>
      )}
      <Surface className="proposal-history" eyebrow="RECENT REQUESTS" title="Agent proposals">
        {accountProposals.length ? accountProposals.map((proposal) => <ProposalLine key={proposal.id} proposal={proposal} />) : <div className="empty-inline">No proposals for this account.</div>}
      </Surface>
    </>
  );
}

function ProposalLine({ proposal }: { proposal: Proposal }) {
  return (
    <div className="proposal-line">
      <span className={`proposal-status proposal-status--${proposal.status}`}>{proposal.status}</span>
      <span className="proposal-line-copy"><strong>{formatZec(proposal.amountZatoshis)} ZEC</strong><small>{proposal.reason}</small></span>
      <span className="proposal-line-recipient">{proposal.to.slice(0, 16)}…</span>
      <span className="proposal-source">{proposal.source}</span>
    </div>
  );
}

function Approvals({ state }: { state: AppState }) {
  const { request } = useBank();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const pending = state.proposals.filter((proposal) => proposal.status === "pending").slice().reverse();
  const agentNames = useMemo(() => new Map(state.agents.map((agent) => [agent.id, agent.displayName])), [state.agents]);

  async function decide(id: string, action: "approve" | "reject") {
    setWorking(id);
    try {
      await request(`/api/proposals/${id}/${action}`, { note: notes[id] ?? "" });
    } catch {
      // The shared shell shows the API error.
    } finally {
      setWorking(null);
    }
  }

  return (
    <>
      <PageIntro eyebrow="OWNER CONTROL" title="Approvals" description="Every payment is rechecked against its mandate and real spendable balance before broadcast." />
      {pending.length ? (
        <div className="approval-list">
          {pending.map((proposal) => (
            <Surface className="approval-card" key={proposal.id}>
              <div className="approval-card-top">
                <div className="agent-byline"><span className="account-avatar"><Wallet size={16} /></span><span><strong>{agentNames.get(proposal.agentId) ?? "Agent account"}</strong><small>PROPOSED {new Date(proposal.createdAt).toLocaleString()}</small></span></div>
                <span className="proposal-status proposal-status--pending">PENDING REVIEW</span>
              </div>
              <div className="approval-amount">{formatZec(proposal.amountZatoshis)} <small>ZEC</small></div>
              <p className="approval-reason">{proposal.reason}</p>
              <div className="approval-recipient"><span className="eyebrow">TO</span><code>{resolvePayee(proposal.to, state.payees)}</code><small>{proposal.to}</small></div>
              <div className="approval-hash"><span className="eyebrow">PROPOSAL HASH · SHA-256</span><code>{proposal.proposalHash}</code></div>
              {proposal.draftNote && <p className="muted-copy">{proposal.draftNote}</p>}
              <label className="field-label" htmlFor={`note-${proposal.id}`}>APPROVAL NOTE (OPTIONAL)</label>
              <input id={`note-${proposal.id}`} className="text-field" value={notes[proposal.id] ?? ""} onChange={(event) => setNotes({ ...notes, [proposal.id]: event.target.value })} placeholder="Add to the audit record" />
              <div className="approval-actions">
                <Button className="nb-button nb-button--primary" disabled={working !== null} onClick={() => void decide(proposal.id, "approve")}>
                  {working === proposal.id ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Approve & broadcast
                </Button>
                <Button className="nb-button nb-button--outline" disabled={working !== null} onClick={() => void decide(proposal.id, "reject")}><X size={15} /> Reject</Button>
              </div>
              <p className="approval-footnote">Approval re-evaluates the mandate and fee-inclusive spendable balance before sending.</p>
            </Surface>
          ))}
        </div>
      ) : (
        <Surface className="empty-panel">
          <div className="empty-state-icon"><BadgeCheck size={20} /></div>
          <h2>All caught up.</h2>
          <p>There are no pending payment proposals. Agent requests appear here before anything is broadcast.</p>
        </Surface>
      )}
    </>
  );
}

function resolvePayee(address: string, payees: Payee[]): string {
  return payees.find((payee) => payee.unifiedAddress === address)?.name ?? "Address not in payee book";
}

function Payees({ state }: { state: AppState }) {
  const { request } = useBank();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await request("/api/payees", { name, unifiedAddress: address });
      setName("");
      setAddress("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add payee.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageIntro eyebrow="ADDRESS BOOK" title="Payees" description="Named unified addresses for agent mandates and payment instructions. Add only addresses you have verified." />
      <div className="payees-layout">
        <Surface className="payee-list-surface" title={`${state.payees.length} saved ${state.payees.length === 1 ? "payee" : "payees"}`}>
          {state.payees.length ? state.payees.map((payee) => (
            <div className="payee-row" key={payee.id}>
              <span className="payee-avatar">{payee.name.charAt(0).toUpperCase()}</span>
              <span className="payee-row-copy"><strong>{payee.name}</strong><code>{payee.unifiedAddress}</code></span>
              <span className="label-chip">TESTNET UA</span>
              <CopyButton value={payee.unifiedAddress} />
            </div>
          )) : <div className="empty-state"><div className="empty-state-icon"><BookUser size={19} /></div><strong>Your address book is empty</strong><span>Agent mandates can only allow addresses saved here.</span></div>}
        </Surface>
        <Surface className="payee-form-surface" eyebrow="NEW PAYEE" title="Add an address">
          <form className="stack-form" onSubmit={submit}>
            <label className="field-label" htmlFor="payee-name">NAME</label>
            <input id="payee-name" className="text-field" value={name} onChange={(event) => setName(event.target.value)} required maxLength={64} placeholder="Contractor, vendor…" />
            <label className="field-label" htmlFor="payee-address">UNIFIED ADDRESS</label>
            <textarea id="payee-address" className="text-field text-area address-entry" value={address} onChange={(event) => setAddress(event.target.value.trim())} required placeholder="utest1…" />
            <div className="field-hint"><ShieldCheck size={14} /> Verify the recipient address before saving. Mainnet addresses are not accepted for this testnet bank.</div>
            {error && <div className="form-error">{error}</div>}
            <Button className="nb-button nb-button--primary" type="submit" disabled={busy || !state.wallet.opened}>
              {busy ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Save payee
            </Button>
          </form>
        </Surface>
      </div>
    </>
  );
}

type StatementsPayload = {
  transactions: { txid: string; minedHeight: number | null }[];
  audit: AppState["audit"];
};

function Statements({ state }: { state: AppState }) {
  const searchParams = useSearchParams();
  const accounts = useMemo(() => [
    ...(state.treasury ? [{ id: "treasury", name: "Treasury" }] : []),
    ...state.agents.map((agent) => ({ id: agent.id, name: agent.displayName })),
  ], [state.treasury, state.agents]);
  const [accountId, setAccountId] = useState(() => searchParams.get("accountId") ?? accounts[0]?.id ?? "treasury");
  const [data, setData] = useState<StatementsPayload | null>(null);
  const [loadedAccountId, setLoadedAccountId] = useState<string | null>(null);
  const loading = Boolean(accountId && state.wallet.opened && loadedAccountId !== accountId);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { request } = useBank();

  useEffect(() => {
    if (!accountId || !state.wallet.opened) return;
    fetch(`/api/statements?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load chain transactions.");
        setData(payload as StatementsPayload);
        setError(null);
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load statements."))
      .finally(() => setLoadedAccountId(accountId));
  }, [accountId, state.wallet.opened, state.wallet.lastSyncAt]);

  async function reveal() {
    setError(null);
    try {
      const result = await request<{ viewingKey: string }>(`/api/accounts/${accountId}/viewing-key`);
      setViewingKey(result.viewingKey);
      setRevealed(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reveal viewing key.");
    }
  }

  return (
    <>
      <PageIntro eyebrow="CHAIN RECORDS" title="Statements" description="Every transaction on your accounts, read from Zcash. Viewing keys are shared only on request." />
      <div className="statement-toolbar">
        <label className="field-label" htmlFor="statement-account">ACCOUNT</label>
        <select id="statement-account" className="text-field statement-select" value={accountId} onChange={(event) => { setAccountId(event.target.value); setRevealed(false); setViewingKey(null); }}>
          {!accounts.length && <option value="treasury">Treasury</option>}
          {accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}
        </select>
        <Button className="nb-button nb-button--outline" onClick={() => void reveal()} disabled={!state.wallet.opened}><KeyRound size={15} /> Reveal viewing key</Button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {revealed && viewingKey && (
        <Surface className="viewing-key-panel" eyebrow="ACCOUNTANT / AUDITOR ACCESS" title="Unified full viewing key">
          <p>This key can disclose the account’s transaction history. Share it only with an accountant or auditor you trust. It cannot spend funds.</p>
          <div className="viewing-key-value"><code>{viewingKey}</code><CopyButton value={viewingKey} /></div>
        </Surface>
      )}
      <Surface className="statement-table" eyebrow="ACCOUNT ACTIVITY" title={loading ? "Syncing statement…" : "On-chain activity"}>
        {loading ? <div className="loading-row"><LoaderCircle className="spin" size={17} /> Reading account activity</div> : data?.transactions.length ? data.transactions.slice().reverse().map((transaction) => (
          <div className="transaction-row" key={transaction.txid}>
            <span className="transaction-glyph"><ArrowUpRight size={17} /></span>
            <span className="transaction-copy"><strong>{transaction.txid}</strong><small>{transaction.minedHeight === null ? "Unmined / pending" : `Mined at height ${transaction.minedHeight.toLocaleString()}`}</small></span>
            <span className="chain-label">TESTNET</span>
          </div>
        )) : <div className="empty-inline">No transactions are recorded for this account yet.</div>}
        <p className="statement-note">Amounts and dates appear once a transaction is confirmed on Zcash.</p>
      </Surface>
      <Surface className="statement-audit" eyebrow="OWNER RECORD" title="Audit trail">
        <AuditList events={data?.audit.slice().reverse() ?? []} />
      </Surface>
    </>
  );
}

function AuditList({ events }: { events: AppState["audit"] }) {
  if (!events.length) return <div className="empty-inline">No audit events recorded yet.</div>;
  return (
    <div className="audit-list">
      {events.map((event) => (
        <div className="audit-row" key={event.id}>
          <span className={`audit-mark audit-mark--${event.decision}`}><FileClock size={14} /></span>
          <span className="audit-row-copy"><strong>{event.decision.replaceAll("_", " ")}</strong><small>{event.detail}</small></span>
          <time>{new Date(event.timestamp).toLocaleString()}</time>
        </div>
      ))}
    </div>
  );
}

function Settings({ state }: { state: AppState }) {
  return (
    <>
      <PageIntro eyebrow="BANK CONFIGURATION" title="Settings" description="Bank status and network configuration for this Noirbank instance." />
      <div className="settings-grid">
        <Surface eyebrow="BANK" title="Bank status">
          <SettingRow label="Status" value={state.wallet.opened ? state.wallet.ready ? "Ready · testnet" : "Opened · needs attention" : "Not opened"} />
          <SettingRow label="Wallet backend" value="zcash-devtool" />
          <SettingRow label="Network" value="Zcash testnet" />
          <SettingRow label="Lightwalletd server" value={state.wallet.server} />
          <SettingRow label="CLI binary" value={state.wallet.binaryPath} />
          <SettingRow label="Vault directory" value={state.wallet.vaultDir} />
          <SettingRow label="Age identity" value={`${state.wallet.vaultDir}/identity.txt`} />
        </Surface>
        <Surface eyebrow="OPTIONAL DRAFTER" title="OpenAI">
          <div className="openai-status"><span className={`status-dot ${state.wallet.openaiConfigured ? "status-dot--green" : ""}`} /><strong>{state.wallet.openaiConfigured ? "Configured" : "Not configured"}</strong></div>
          <p className="settings-copy">Without an API key, Noirbank parses explicit payment instructions and payee names locally. With a key, OpenAI can draft a proposal; policy checks and owner approval still apply.</p>
          <div className="setting-note"><ShieldCheck size={16} /> No model receives keys or approval authority.</div>
        </Surface>
        <Surface eyebrow="SAFETY MODEL" title="What the mandate does">
          <p className="settings-copy">Mandates are application-side checks. The owner re-evaluates the mandate and chain spendable balance before a payment is broadcast. They are not Zcash consensus constraints.</p>
          <p className="settings-copy">Each agent account is a separate shielded Zcash account. Keys are kept encrypted on this server.</p>
        </Surface>
      </div>
    </>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return <div className="setting-row"><span>{label}</span><code>{value}</code></div>;
}

export function BankView({ section }: { section: Section }) {
  const { state, loading } = useBank();
  if (!state) {
    return (
      <div className="loading-panel">
        <LoaderCircle className="spin" size={20} />
        <span>{loading ? "Connecting to your bank…" : "Bank state unavailable"}</span>
      </div>
    );
  }
  switch (section) {
    case "overview": return <Overview state={state} />;
    case "accounts": return <Accounts state={state} />;
    case "account": return <AccountDetail state={state} />;
    case "approvals": return <Approvals state={state} />;
    case "payees": return <Payees state={state} />;
    case "statements": return <Statements state={state} />;
    case "settings": return <Settings state={state} />;
  }
}
