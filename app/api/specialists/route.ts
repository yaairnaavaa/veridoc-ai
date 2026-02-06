// app/api/specialists/route.ts (Ejemplo conceptual)
import User from "@/lib/models/User";
import dbConnect from "@/lib/mongodb";

export async function GET(request: Request) {
  await dbConnect();

  const specialists = await User.find({
    "specialistProfile.status": "published", // Solo perfiles públicos
    // "specialistProfile.isVerified": true // (Opcional) Solo verificados
  })
  .select("name image specialistProfile") // Projection: Trae solo lo necesario
  .lean(); // Rendimiento: Objetos JS planos, no documentos Mongoose pesados

  return Response.json(specialists);
}