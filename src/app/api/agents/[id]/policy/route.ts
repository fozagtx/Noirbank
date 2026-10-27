import type { NextRequest } from "next/server";

import { handle, readJson } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return handle(async () => getService().updatePolicy(id, await readJson(request)));
}
