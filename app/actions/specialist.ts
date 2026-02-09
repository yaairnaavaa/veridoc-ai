"use server";

import { z } from "zod";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { revalidatePath } from "next/cache";
import { uploadToCloudinary } from "@/lib/cloudinary";
import path from "path";
import fs from "fs/promises";

// ----------------------------------------------------------------------
// 1. VALIDATION SCHEMA (Zod)
// ----------------------------------------------------------------------
const SpecialistFormSchema = z.object({
  title: z.string().min(2, "Title is too short").max(50),
  specialty: z.string().min(2, "Please select a valid specialty"),
  bio: z.string().max(500, "Biography cannot exceed 500 characters").optional(),
  languages: z.string().transform((str) => str.split(",").map((s) => s.trim())),
  experienceYears: z.coerce.number().min(0),
  pricePerSession: z.coerce.number().min(0),
  availability: z.string().optional(),
});

// ----------------------------------------------------------------------
// 2. SERVER ACTION
// ----------------------------------------------------------------------

export type State = {
  success?: boolean;
  message?: string | null;
  errors?: {
    [K in keyof z.infer<typeof SpecialistFormSchema>]?: string[];
  };
};

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

export async function updateSpecialistProfile(
  walletAddress: string,
  prevState: State,
  formData: FormData
) {
  // 1. Validar campos de texto con Zod
  const rawData = Object.fromEntries(formData.entries());
  const validatedFields = SpecialistFormSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Please check the form errors.",
    };
  }

  const { data } = validatedFields;

  // 2. Subida a Cloudinary: título y cédula (opcional, imagen o PDF)
  let titleDocumentUrl: string | undefined;
  let cedulaUrl: string | undefined;

  const titleDocumentFile = formData.get("titleDocument") as File | null;
  const cedulaFile = formData.get("cedula") as File | null;

  if (titleDocumentFile?.name && titleDocumentFile?.size > 0) {
    const buffer = Buffer.from(await titleDocumentFile.arrayBuffer());
    const url = await uploadToCloudinary(
      buffer,
      titleDocumentFile.name,
      titleDocumentFile.type || "application/octet-stream",
      "veridoc/specialist-verification/title"
    );
    if (url) titleDocumentUrl = url;
  }

  if (cedulaFile?.name && cedulaFile?.size > 0) {
    const buffer = Buffer.from(await cedulaFile.arrayBuffer());
    const url = await uploadToCloudinary(
      buffer,
      cedulaFile.name,
      cedulaFile.type || "application/octet-stream",
      "veridoc/specialist-verification/cedula"
    );
    if (url) cedulaUrl = url;
  }

  // 3. LOGICA DE SUBIDA DE IMAGEN (perfil)
  let profileImagePath: string | undefined = undefined;

  const imageFile = formData.get("image") as File | null;

  // Verificamos si existe y es un archivo válido (tiene nombre y tamaño > 0)
  if (imageFile && imageFile.name && imageFile.size > 0) {
    try {
      // Definimos la carpeta de destino (public/uploads)
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      
      // Aseguramos que la carpeta exista
      await fs.mkdir(uploadDir, { recursive: true });

      // Creamos un nombre único para evitar sobrescribir
      // Ej: demo-wallet-123-167890000-mifoto.jpg
      const timestamp = Date.now();
      const safeFileName = imageFile.name.replace(/\s+/g, "-").toLowerCase(); // Quitamos espacios
      const uniqueFileName = `${walletAddress}-${timestamp}-${safeFileName}`;
      const filePath = path.join(uploadDir, uniqueFileName);

      // Convertimos el archivo a un Buffer para poder guardarlo
      const arrayBuffer = await imageFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Escribimos el archivo en el disco
      await fs.writeFile(filePath, buffer);

      // Guardamos la ruta pública (que empieza con /uploads/...)
      profileImagePath = `/uploads/${uniqueFileName}`;
      console.log("Imagen guardada en:", profileImagePath);

    } catch (error) {
      console.error("Error uploading image:", error);
      // No detenemos el proceso, simplemente no se guarda la imagen
    }
  }


  // 4. Procesar disponibilidad
  let parsedAvailability = [];
  try {
    if (rawData.availability) {
      parsedAvailability = JSON.parse(rawData.availability as string);
    }
  } catch (e) { }

  // 5. Conexión a Base de Datos
  try {
    await dbConnect();

    const updatedUser = await User.findOneAndUpdate(
      { walletAddress: walletAddress },
      {
        $set: {
          specialistProfile: {
            title: data.title,
            specialty: data.specialty,
            bio: data.bio,
            languages: data.languages,
            experienceYears: data.experienceYears,
            pricePerSession: data.pricePerSession,
            currency: "USD",
            ...(profileImagePath && { image: profileImagePath }),
            ...(titleDocumentUrl && { titleDocumentUrl }),
            ...(cedulaUrl && { cedulaUrl }),

            availability: parsedAvailability,
            status: "published",
            updatedAt: new Date(),
            isVerified: false,
          },
        },
        $setOnInsert: {
          name: data.title || "Nuevo Especialista",
          email: `demo-${Date.now()}@veridoc.dev`,
          createdAt: new Date(),
        }
      },
      { new: true, upsert: true, runValidators: true }
    );

    if (!updatedUser) {
      return { success: false, message: "Critical error: Could not create/update the user." };
    }

    // 6. Enviar datos de verificación al API externo (título y cédula URLs)
    const verificationApiUrl = process.env.SPECIALIST_VERIFICATION_API_URL;
    if (verificationApiUrl) {
      try {
        const payload = {
          walletAddress,
          title: data.title,
          specialty: data.specialty,
          titleDocumentUrl: titleDocumentUrl ?? null,
          cedulaUrl: cedulaUrl ?? null,
          profileImagePath: profileImagePath ?? (updatedUser.specialistProfile?.image ?? null),
        };
        const res = await fetch(`${verificationApiUrl.replace(/\/$/, "")}/specialists/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.warn("Verification API responded with", res.status, await res.text());
        }
      } catch (e) {
        console.warn("Verification API request failed:", e);
      }
    }

    revalidatePath("/marketplace");
    revalidatePath("/profile");

    return { success: true, message: "Specialist profile updated successfully!" };

  } catch (error) {
    console.error("Database Error:", error);
    return {
      success: false,
      message: "Server error. Check the console.",
    };
  }
}