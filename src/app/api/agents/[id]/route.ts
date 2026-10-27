import { connection } from "next/server";
import type { NextRequest } from "next/server";

import { handle } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await context.params;
  return handle(() => getService().getAgent(id));
}
