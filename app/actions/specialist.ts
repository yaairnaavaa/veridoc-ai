"use server";

import { z } from "zod";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { revalidatePath } from "next/cache";
// Necesitamos estos imports de Node.js para manejar archivos
import path from "path";
import fs from "fs/promises";

// ----------------------------------------------------------------------
// 1. VALIDATION SCHEMA (Zod)
// ----------------------------------------------------------------------
// Nota: Zod no valida objetos 'File' directamente en el schema de formulario
// Lo validaremos manualmente en la acción.
const SpecialistFormSchema = z.object({
  title: z.string().min(2, "El título es muy corto").max(50),
  specialty: z.string().min(2, "Selecciona una especialidad válida"),
  bio: z.string().max(500, "La biografía no puede exceder 500 caracteres").optional(),
  languages: z.string().transform((str) => str.split(",").map((s) => s.trim())),
  experienceYears: z.coerce.number().min(0),
  pricePerSession: z.coerce.number().min(0),
  availability: z.string().optional(),
  // No incluimos 'image' aquí porque la trataremos aparte
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
      message: "Por favor revisa los errores en el formulario.",
    };
  }

  const { data } = validatedFields;

  // 2. LOGICA DE SUBIDA DE IMAGEN (NUEVO)
  let profileImagePath: string | undefined = undefined;

  // Obtenemos el archivo del formData
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
      console.error("Error subiendo imagen:", error);
      // No detenemos el proceso, simplemente no se guarda la imagen
    }
  }


  // 3. Procesar disponibilidad
  let parsedAvailability = [];
  try {
    if (rawData.availability) {
      parsedAvailability = JSON.parse(rawData.availability as string);
    }
  } catch (e) { }

  // 4. Conexión a Base de Datos
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
            // AÑADIMOS LA IMAGEN (Si se subió una nueva)
            ...(profileImagePath && { image: profileImagePath }), 

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
      return { success: false, message: "Error crítico: No se pudo crear/actualizar el usuario." };
    }

    revalidatePath("/marketplace");
    revalidatePath("/profile");

    return { success: true, message: "¡Perfil de especialista actualizado con éxito!" };

  } catch (error) {
    console.error("Database Error:", error);
    return {
      success: false,
      message: "Error de servidor. Revisa la consola.",
    };
  }
}