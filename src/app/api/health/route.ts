import { connection } from "next/server";

import { getService } from "@/lib/server/runtime";

export async function GET() {
  await connection();
  const { wallet } = await getService().snapshot();
  return Response.json({
    ok: true,
    product: "noirbank",
    wallet,
  });
}
