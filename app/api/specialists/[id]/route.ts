import { NextRequest } from "next/server";
import { getSpecialistByIdFromApi } from "@/lib/marketplace/specialists";

const getBaseUrl = () => process.env.SPECIALIST_VERIFICATION_API_URL?.replace(/\/$/, "");

/**
 * GET /api/specialists/:id
 * Returns one specialist in UiSpecialist shape (from external API or null).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    const specialist = await getSpecialistByIdFromApi(id);
    if (!specialist) {
      return Response.json({ error: "Specialist not found" }, { status: 404 });
    }
    return Response.json(specialist);
  } catch (e) {
    console.error("Specialist API proxy error:", e);
    return Response.json(
      { error: "Failed to fetch specialist" },
      { status: 502 }
    );
  }
}

/**
 * PUT /api/specialists/:id
 * Proxies to the external verification API to update a specialist by id (privyWallet).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const baseUrl = getBaseUrl();
  if (!baseUrl || !id) {
    return Response.json(
      { error: "Not configured or missing id" },
      { status: 400 }
    );
  }
  try {
    const body = await request.json();
    const url = `${baseUrl}/api/specialists/${encodeURIComponent(id)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return Response.json(data, { status: res.status });
    }
    return Response.json(data);
  } catch (e) {
    console.error("Specialist API proxy PUT error:", e);
    return Response.json(
      { error: "Failed to update specialist" },
      { status: 502 }
    );
  }
}
