import { connection } from "next/server";

import { handle } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

export async function GET(request: Request) {
  await connection();
  const accountId = new URL(request.url).searchParams.get("accountId") || "treasury";
  return handle(() => getService().statements(accountId));
}
