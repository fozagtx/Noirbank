import { connection } from "next/server";

import { handle } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

export async function GET() {
  await connection();
  return handle(() => getService().snapshot());
}

export async function POST() {
  return handle(() => getService().openBank());
}
