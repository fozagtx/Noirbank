import type { NextRequest } from "next/server";
import { z } from "zod";

import { AgentError } from "@/lib/errors";
import { parseAmountInput } from "@/lib/service";
import { handle, readJson } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

const bodySchema = z
  .object({
    prompt: z.string().optional(),
    to: z.string().optional(),
    amountZec: z.string().optional(),
    amountZatoshis: z.number().optional(),
    reason: z.string().optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handle(async () => {
    const body = bodySchema.parse(await readJson(request));
    const hasManual =
      body.to !== undefined ||
      body.amountZec !== undefined ||
      body.amountZatoshis !== undefined ||
      body.reason !== undefined;
    if (body.prompt && hasManual) {
      throw new AgentError("Send a prompt or a manual spend, not both.", 400);
    }
    const service = getService();
    if (body.prompt) return service.proposeFromPrompt(id, body.prompt);
    if (!body.to || !body.reason) {
      throw new AgentError("A manual spend needs to, an amount, and a reason.", 400);
    }
    return service.proposeManual({
      agentId: id,
      to: body.to,
      amountZatoshis: parseAmountInput(body),
      reason: body.reason,
    });
  });
}
