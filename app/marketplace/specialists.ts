import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

/** Specialist verification status from the API. Only these two values are used. */
export type SpecialistStatus = "Verified" | "Under Review";

export type UiSpecialist = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  experience: number;
  languages: string[];
  tags: string[];
  priceUsdt: number;
  availability: string;
  image: string;
  location: string;
  /** Derived for display: true when status is Verified or Under Review */
  verified: boolean;
  /** Verification status: 'Verified' | 'Under Review' */
  status: SpecialistStatus | "";
  isMock?: boolean;
  /** URL to license/ID document (e.g. cédula profesional) */
  licenseDocumentUrl?: string;
  /** URL to degree/title document (e.g. título) */
  degreeDocumentUrl?: string;
};

/** Shape of one specialist from the external verification API (GET /api/specialists) */
type ApiSpecialist = {
  _id?: string;
  professionalTitle?: string;
  specialty?: string;
  profileImageUrl?: string;
  yearsOfExperience?: number;
  consultationPrice?: number;
  languages?: string[];
  status?: string;
  privyWallet?: string;
  licenseDocumentUrl?: string;
  degreeDocumentUrl?: string;
  [key: string]: unknown;
};

function normalizeStatus(status: string | undefined): UiSpecialist["status"] {
  if (!status) return "";
  const s = status.trim();
  if (s === "Verified" || s === "Under Review") return s;
  if (s === "Verificado") return "Verified";
  return "";
}

function mapApiSpecialistToUi(item: ApiSpecialist): UiSpecialist {
  const id = String(item._id ?? item.privyWallet ?? "");
  const status = normalizeStatus(item.status);
  return {
    id,
    name: item.professionalTitle ?? "Specialist",
    specialty: item.specialty ?? "Blood panel review",
    rating: 5,
    reviews: 0,
    experience: item.yearsOfExperience ?? 0,
    languages: Array.isArray(item.languages) ? item.languages : [],
    tags: [],
    priceUsdt: item.consultationPrice ?? 0,
    availability: "Consultar",
    image: item.profileImageUrl || `https://static.vecteezy.com/system/resources/previews/048/926/084/non_2x/silver-membership-icon-default-avatar-profile-icon-membership-icon-social-media-user-image-illustration-vector.jpg`,
    location: "Online",
    verified: status === "Verified" || status === "Under Review",
    status,
    isMock: false,
    licenseDocumentUrl: item.licenseDocumentUrl,
    degreeDocumentUrl: item.degreeDocumentUrl,
  };
}

/** Fetches specialists from the external verification API (GET /api/specialists). */
export async function getSpecialistsFromApi(): Promise<UiSpecialist[]> {
  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
  if (!baseUrl) {
    console.warn("SPECIALIST_VERIFICATION_API_URL not set, marketplace will be empty.");
    return [];
  }
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/specialists`;
    const res = await fetch(url, { cache: "no-store" });
    const raw = await res.json().catch(() => null);
    if (!res.ok) return [];
    const list = Array.isArray(raw) ? raw : raw?.data;
    if (!Array.isArray(list)) return [];
    return list.map((item: ApiSpecialist) => mapApiSpecialistToUi(item));
  } catch (e) {
    console.warn("Marketplace: failed to fetch specialists from API.", e);
    return [];
  }
}

export function mapUserToSpecialist(user: { _id: unknown; name?: string; image?: string; specialistProfile?: Record<string, unknown> | unknown }): UiSpecialist {
  const profile = (user.specialistProfile || {}) as Record<string, unknown>;
  const nextSlot =
    profile.availability && Array.isArray(profile.availability) && profile.availability.length > 0
      ? `${(profile.availability[0] as { day?: string }).day}, ${((profile.availability[0] as { slots?: string[] }).slots?.[0] ?? "—")}`
      : "Consultar";
  const displayImage =
    (profile.image as string) ||
    (user.image as string) ||
    `https://i.pravatar.cc/150?u=${user._id}`;
  const status = normalizeStatus(profile.status as string | undefined);
  return {
    id: String(user._id),
    name: (profile.title as string) || (user.name as string) || "Specialist",
    specialty: (profile.specialty as string) || "Blood panel review",
    rating: (profile.rating as number) ?? 5.0,
    reviews: (profile.reviewCount as number) ?? 0,
    experience: (profile.experienceYears as number) ?? 0,
    languages: (profile.languages as string[]) ?? [],
    tags: profile.certifications ? (profile.certifications as string[]).slice(0, 3) : [],
    priceUsdt: (profile.pricePerSession as number) ?? 0,
    availability: nextSlot,
    image: displayImage,
    location: "Online",
    verified: (profile.isVerified as boolean) ?? (status === "Verified" || status === "Under Review"),
    status,
    isMock: false,
    licenseDocumentUrl: profile.licenseDocumentUrl as string | undefined,
    degreeDocumentUrl: profile.degreeDocumentUrl as string | undefined,
  };
}

export async function getSpecialistsFromDb(): Promise<UiSpecialist[]> {
  try {
    await dbConnect();
    const users = await User.find({ "specialistProfile.status": "published" })
      .select("name image specialistProfile")
      .lean();
    return users.map((u) => mapUserToSpecialist(u));
  } catch (e) {
    console.warn("Marketplace: MongoDB unavailable, showing only mock/local data.", e);
    return [];
  }
}

/** Fetches one specialist by id from the external API (GET /api/specialists/:id). */
export async function getSpecialistByIdFromApi(id: string): Promise<UiSpecialist | null> {
  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
  if (!baseUrl) return null;
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/specialists/${encodeURIComponent(id)}`;
    const res = await fetch(url, { cache: "no-store" });
    const raw = await res.json().catch(() => null);
    if (!res.ok) return null;
    const item = raw?.data ?? raw;
    if (!item || typeof item !== "object") return null;
    return mapApiSpecialistToUi(item as ApiSpecialist);
  } catch (e) {
    console.warn("Marketplace: failed to fetch specialist by id from API.", e);
    return null;
  }
}

/** Fetches one specialist by identifier from the external API (GET /api/specialists/identifier/:identifier). */
export async function getSpecialistByIdentifierFromApi(identifier: string): Promise<UiSpecialist | null> {
  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
  if (!baseUrl) return null;
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/specialists/identifier/${encodeURIComponent(identifier)}`;
    const res = await fetch(url, { cache: "no-store" });
    const raw = await res.json().catch(() => null);
    if (!res.ok) return null;
    const item = raw?.data ?? raw;
    if (!item || typeof item !== "object") return null;
    return mapApiSpecialistToUi(item as ApiSpecialist);
  } catch (e) {
    console.warn("Marketplace: failed to fetch specialist by identifier from API.", e);
    return null;
  }
}

export async function getSpecialistById(id: string): Promise<UiSpecialist | null> {
  const fromApi = await getSpecialistByIdFromApi(id);
  if (fromApi) return fromApi;
  try {
    await dbConnect();
    const user = await User.findById(id).select("name image specialistProfile").lean();
    if (!user) return null;
    return mapUserToSpecialist(user);
  } catch (e) {
    console.warn("Marketplace: MongoDB unavailable for specialist detail.", e);
    return null;
  }
}
