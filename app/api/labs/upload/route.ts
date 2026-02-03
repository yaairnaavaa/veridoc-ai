import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Lab from "@/lib/models/Lab";

export async function POST(request: Request) {
  try {
    // 1. Conectar a la base de datos
    await dbConnect();

    // 2. Obtener el archivo del formulario
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    // 3. Convertir el archivo a Buffer (formato que entiende Mongo)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 4. Guardar en MongoDB
    const newLab = await Lab.create({
      fileName: file.name,
      contentType: file.type,
      fileData: buffer,
      size: file.size,
    });

    return NextResponse.json({ 
      message: "Archivo guardado exitosamente", 
      id: newLab._id 
    }, { status: 201 });

  } catch (error: any) {
    console.error("Error subiendo archivo:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}