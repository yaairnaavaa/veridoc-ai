"use server";

import crypto from "crypto";

/** Parsea CLOUDINARY_URL (cloudinary://api_key:api_secret@cloud_name) o variables por separado. */
function getCloudinaryConfig(): { cloudName: string; apiKey: string; apiSecret: string } | null {
  const url = process.env.CLOUDINARY_URL;
  if (url?.startsWith("cloudinary://")) {
    try {
      const u = new URL(url);
      const cloudName = u.hostname || u.host;
      const apiKey = decodeURIComponent(u.username);
      const apiSecret = decodeURIComponent(u.password);
      if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
    } catch {
      // fallback a variables separadas
    }
  }
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

export type CloudinaryResourceType = "image" | "raw";

function getResourceType(mime: string): CloudinaryResourceType {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "raw";
  return "raw";
}

/**
 * Sube un archivo (imagen o PDF) a Cloudinary y devuelve la URL segura.
 * Usar solo en servidor (credenciales).
 */
export async function uploadToCloudinary(
  file: Buffer,
  originalName: string,
  mimeType: string,
  folder = "veridoc/specialist-verification"
): Promise<string | null> {
  const config = getCloudinaryConfig();
  if (!config) {
    console.warn("Cloudinary: configura CLOUDINARY_URL o las variables por separado. No se subirá el archivo.");
    return null;
  }

  const { cloudName, apiKey, apiSecret } = config;
  const resourceType = getResourceType(mimeType);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params: Record<string, string> = {
    timestamp,
    folder,
  };

  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");

  const formData = new FormData();
  // Buffer.buffer is ArrayBufferLike; Blob expects BlobPart (ArrayBuffer). Use a copy.
  formData.append("file", new Blob([new Uint8Array(file)], { type: mimeType }), originalName);
  formData.append("api_key", apiKey);
  formData.append("timestamp", timestamp);
  formData.append("signature", signature);
  formData.append("folder", folder);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Cloudinary upload error:", res.status, err);
      return null;
    }

    const data = (await res.json()) as { secure_url?: string };
    return data.secure_url ?? null;
  } catch (e) {
    console.error("Cloudinary upload exception:", e);
    return null;
  }
}
