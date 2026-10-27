import type { NextRequest } from "next/server";
import { z } from "zod";

import { handle, readJson } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

const bodySchema = z.object({ note: z.string().optional() }).strict();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handle(async () => {
    const body = bodySchema.parse(await readJson(request));
    return getService().reject(id, body.note);
  });
}
