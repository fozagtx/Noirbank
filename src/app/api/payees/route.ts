import type { NextRequest } from "next/server";
import { z } from "zod";

import { handle, readJson } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

const payeeSchema = z.object({
  name: z.string(),
  unifiedAddress: z.string(),
}).strict();

export async function GET() {
  return handle(() => getService().payees());
}

export async function POST(request: NextRequest) {
  return handle(async () => getService().addPayee(payeeSchema.parse(await readJson(request))));
}
