import { connection } from "next/server";
import type { NextRequest } from "next/server";

import { handle } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

export async function GET(request: NextRequest) {
  await connection();
  const agentId = request.nextUrl.searchParams.get("agentId");
  return handle(() => getService().audit(agentId));
}
