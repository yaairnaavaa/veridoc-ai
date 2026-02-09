import { NextRequest } from "next/server";
import { getSpecialistByIdentifierFromApi } from "@/app/marketplace/specialists";

/**
 * GET /api/specialists/identifier/:identifier
 * Returns one specialist in UiSpecialist shape (from external API).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params;
  if (!identifier) {
    return Response.json({ error: "Missing identifier" }, { status: 400 });
  }
  try {
    const specialist = await getSpecialistByIdentifierFromApi(identifier);
    if (!specialist) {
      return Response.json({ error: "Specialist not found" }, { status: 404 });
    }
    return Response.json(specialist);
  } catch (e) {
    console.error("Specialist identifier API error:", e);
    return Response.json(
      { error: "Failed to fetch specialist" },
      { status: 502 }
    );
  }
}
