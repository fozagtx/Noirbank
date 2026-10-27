import { z } from "zod";

import { isUnifiedAddress } from "../addresses";
import { AgentError } from "../errors";
import { zecToZatoshis } from "../money";
import type { Payee, ProposalSource } from "../types";
import type { Policy } from "../policy/schema";

export type Draft = {
  to: string;
  amountZatoshis: number;
  reason: string;
  source: Extract<ProposalSource, "parser" | "openai">;
  note: string | null;
};

const modelDraftSchema = z.object({
  to: z.string().min(1),
  amountZatoshis: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});

function parseAmount(prompt: string): number {
  const zec = prompt.match(/(\d+(?:\.\d+)?)\s*zec\b/i);
  const zatoshis = prompt.match(/(\d+)\s*zatoshis?\b/i);
  if (zec) return zecToZatoshis(zec[1]);
  if (zatoshis) return Number(zatoshis[1]);
  throw new AgentError("Include a payment amount in ZEC or zatoshis.", 400);
}

function parseRecipient(prompt: string, payees: Payee[]): string {
  const address = prompt.match(/utest1[a-z0-9]+/i)?.[0]?.toLowerCase();
  if (address && isUnifiedAddress(address)) return address;
  const normalized = prompt.toLocaleLowerCase();
  const payee = [...payees]
    .sort((a, b) => b.name.length - a.name.length)
    .find((item) => normalized.includes(item.name.toLocaleLowerCase()));
  if (!payee) {
    throw new AgentError("Name a payee from the address book or include its unified address.", 400);
  }
  return payee.unifiedAddress;
}

export function parseInstruction(
  prompt: string,
  payees: Payee[],
): Omit<Draft, "source" | "note"> {
  const text = prompt.replace(/\s+/g, " ").trim();
  const amountZatoshis = parseAmount(text);
  const to = parseRecipient(text, payees);
  return {
    to,
    amountZatoshis,
    reason: text.slice(0, 400),
  };
}

async function openAiPropose(input: {
  prompt: string;
  policy: Policy;
  agentName: string;
  payees: Payee[];
  env: NodeJS.ProcessEnv;
}): Promise<Draft | null> {
  const key = input.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const model = input.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "Draft a single ZEC payment for an owner to review. Never approve or broadcast.",
              "Reply only as JSON: {\"to\": string, \"amountZatoshis\": integer, \"reason\": string}.",
              "Choose a recipient only from the address book below.",
              `Agent: ${input.agentName}`,
              `Mandate: ${JSON.stringify(input.policy)}`,
              `Payees: ${JSON.stringify(input.payees.map(({ name, unifiedAddress }) => ({ name, unifiedAddress })))}`,
            ].join("\n"),
          },
          { role: "user", content: input.prompt },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = modelDraftSchema.safeParse(JSON.parse(content));
    if (!parsed.success || !input.payees.some((payee) => payee.unifiedAddress === parsed.data.to)) {
      return null;
    }
    return { ...parsed.data, source: "openai", note: null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function draftProposal(input: {
  prompt: string;
  policy: Policy;
  agentName: string;
  payees: Payee[];
  env?: NodeJS.ProcessEnv;
}): Promise<Draft> {
  const env = input.env ?? process.env;
  if (env.OPENAI_API_KEY?.trim()) {
    const drafted = await openAiPropose({ ...input, env });
    if (drafted) return drafted;
    return {
      ...parseInstruction(input.prompt, input.payees),
      source: "parser",
      note: "The model was unavailable; the instruction parser prepared this draft.",
    };
  }
  return {
    ...parseInstruction(input.prompt, input.payees),
    source: "parser",
    note: null,
  };
}
