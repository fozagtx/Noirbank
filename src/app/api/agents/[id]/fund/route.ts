import type { NextRequest } from "next/server";
import { z } from "zod";

import { parseAmountInput } from "@/lib/service";
import { handle, readJson } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

const bodySchema = z
  .object({
    amountZec: z.string().optional(),
    amountZatoshis: z.number().optional(),
  })
  .strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handle(async () => {
    const body = bodySchema.parse(await readJson(request));
    return getService().fundAgent(id, parseAmountInput(body));
  });
}
