"use server";

import { uploadToCloudinary } from "@/lib/cloudinary";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type SpecialistDocument = {
  professionalTitle: string;
  specialty: string;
  biography: string;
  yearsOfExperience: number;
  consultationPrice: number;
  languages: string[];
  nearAddress: string;
  privyWallet: string;
  profileImageUrl: string;
  licenseDocumentUrl: string;
  degreeDocumentUrl: string;
};

// ----------------------------------------------------------------------
// Cloudinary upload
// ----------------------------------------------------------------------

/** Sube las 3 imágenes/archivos a Cloudinary y devuelve sus URLs. */
export async function uploadSpecialistFilesToCloudinary(formData: FormData): Promise<{
  imageUrl: string | null;
  titleDocumentUrl: string | null;
  cedulaUrl: string | null;
}> {
  const imageFile = formData.get("image") as File | null;
  const titleDocumentFile = formData.get("titleDocument") as File | null;
  const cedulaFile = formData.get("cedula") as File | null;

  const uploadOne = async (
    file: File | null,
    folder: string
  ): Promise<string | null> => {
    if (!file?.name || file.size === 0) return null;
    const buffer = Buffer.from(await file.arrayBuffer());
    return uploadToCloudinary(
      buffer,
      file.name,
      file.type || "application/octet-stream",
      folder
    );
  };

  const [imageUrl, titleDocumentUrl, cedulaUrl] = await Promise.all([
    uploadOne(imageFile, "veridoc/specialist-verification/profile"),
    uploadOne(titleDocumentFile, "veridoc/specialist-verification/title"),
    uploadOne(cedulaFile, "veridoc/specialist-verification/cedula"),
  ]);

  return { imageUrl, titleDocumentUrl, cedulaUrl };
}

// ----------------------------------------------------------------------
// External API
// ----------------------------------------------------------------------

/** Envía el documento del especialista al API externo por POST /api/specialists. */
export async function saveSpecialistToApi(document: SpecialistDocument): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  const baseUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
  if (!baseUrl) {
    return { ok: false, error: "SPECIALIST_VERIFICATION_API_URL is not configured" };
  }
  const url = `${baseUrl.replace(/\/$/, "")}/api/specialists`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(document),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, status: res.status, error: text || res.statusText };
    }
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}
