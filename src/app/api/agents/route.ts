import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { handle, readJson } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

const createBody = z
  .object({
    displayName: z.string(),
    roleDescription: z.string().optional(),
    policy: z.unknown().optional(),
  })
  .strict();

export async function GET() {
  await connection();
  return handle(async () => {
    const state = await getService().snapshot();
    return state.agents;
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const body = createBody.parse(await readJson(request));
    return getService().createAgent(body);
  });
}
