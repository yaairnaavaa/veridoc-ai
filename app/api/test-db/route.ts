import dbConnect from "@/lib/mongodb";
import { NextResponse } from "next/server";
// Ya no necesitamos importar mongoose aquí explícitamente para esto

export async function GET() {
  try {
    const conn = await dbConnect();
    
    // Accedemos directamente a la colección
    const db = conn.connection.db;
    
    if (!db) throw new Error("No se pudo obtener la instancia de la base de datos");

    // 1. Aquí guardamos la operación en la variable "resultado"
    const resultado = await db.collection("pruebas_de_conexion").insertOne({
      fecha: new Date(),
      mensaje: "¡Hola MongoDB! Si lees esto, todo funciona perfecto.",
      autor: "Tu Proyecto Veridoc"
    });

    return NextResponse.json({ 
      status: "¡ÉXITO TOTAL!", 
      mensaje: "Se logró conectar y GUARDAR un documento.", 
      // 2. Aquí usamos "resultado" (antes decía result)
      id_guardado: resultado.insertedId,
      base_de_datos: conn.connection.name
    });

  } catch (error: any) {
    return NextResponse.json({ 
      status: "Error", 
      mensaje: error.message 
    }, { status: 500 });
  }
}