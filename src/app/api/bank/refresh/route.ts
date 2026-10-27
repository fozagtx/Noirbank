import { handle } from "@/lib/server/http";
import { getService } from "@/lib/server/runtime";

export async function POST() {
  return handle(() => getService().refresh());
}
