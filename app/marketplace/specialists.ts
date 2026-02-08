import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";

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
  verified: boolean;
  isMock?: boolean;
};

export const MOCK_SPECIALISTS: UiSpecialist[] = [
  {
    id: "mock-1",
    name: "Dr. Elena Torres",
    specialty: "Internal Medicine · Blood Panel Interpretation",
    rating: 4.9,
    reviews: 127,
    experience: 12,
    languages: ["Spanish", "English"],
    tags: ["CBC", "Metabolic panel", "Lipid profile"],
    priceUsdt: 45,
    availability: "Mon–Fri, 48h",
    image: "https://i.pravatar.cc/150?u=elena-torres",
    location: "Online",
    verified: true,
    isMock: true,
  },
  {
    id: "mock-2",
    name: "Dr. James Chen",
    specialty: "Endocrinology · Lab Results Review",
    rating: 4.8,
    reviews: 89,
    experience: 8,
    languages: ["English", "Mandarin"],
    tags: ["Thyroid", "HbA1c", "Hormones"],
    priceUsdt: 55,
    availability: "Tue–Sat, 24h",
    image: "https://i.pravatar.cc/150?u=james-chen",
    location: "Online",
    verified: true,
    isMock: true,
  },
];

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
    verified: (profile.isVerified as boolean) ?? false,
    isMock: false,
  };
}

export async function getSpecialistsFromDb(): Promise<UiSpecialist[]> {
  await dbConnect();
  const users = await User.find({ "specialistProfile.status": "published" })
    .select("name image specialistProfile")
    .lean();
  return users.map((u) => mapUserToSpecialist(u));
}

export function getMockSpecialistById(id: string): UiSpecialist | null {
  return MOCK_SPECIALISTS.find((s) => s.id === id) ?? null;
}

export async function getSpecialistById(id: string): Promise<UiSpecialist | null> {
  const mock = getMockSpecialistById(id);
  if (mock) return mock;
  await dbConnect();
  const user = await User.findById(id).select("name image specialistProfile").lean();
  if (!user) return null;
  return mapUserToSpecialist(user);
}
