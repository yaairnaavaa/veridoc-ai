import { getSpecialistsFromApi } from "@/lib/marketplace/specialists";

/** GET /api/specialists — proxies to external verification API and returns list as UiSpecialist[]. */
export async function GET() {
  const specialists = await getSpecialistsFromApi();
  return Response.json(specialists);
}