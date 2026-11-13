import { fetchOrganizations } from "@/lib/buffer";
import { withToken } from "../handler";

export async function GET() {
  return withToken(async (token) => ({ organizations: await fetchOrganizations(token) }));
}
