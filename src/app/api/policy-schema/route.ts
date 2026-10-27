import { connection } from "next/server";

import policySchemaJson from "../../../../examples/policy.schema.json";

export async function GET() {
  await connection();
  return Response.json(policySchemaJson);
}
