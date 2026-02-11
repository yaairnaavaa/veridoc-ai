'use server'

import { writeFile } from "fs/promises";
import { join } from "path";

const LLAMA_API_URL = "https://api.cloud.llamaindex.ai/api/parsing";

const PDF_MIME = "application/pdf";

export async function analyzeMedicalRecord(formData: FormData) {
  const file = formData.get('file') as File;
  const llamaKey = process.env.LLAMA_CLOUD_API_KEY;

  if (!file || !llamaKey) {
    return { success: false, message: 'Faltan archivos o API Key de LlamaParse.' };
  }
  if (file.type !== PDF_MIME) {
    return { success: false, message: 'Solo se aceptan archivos PDF. Por favor sube tu reporte de laboratorio en PDF.' };
  }

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n🔄 Reintento ${attempt}/${maxRetries} para recuperar el texto del PDF...`);
      }
      const result = await runLlamaParsePipeline(file, llamaKey);
      if (result.success) return result;
      lastError = new Error(result.message ?? "Error desconocido");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
      console.warn(`Intento ${attempt} fallido. Reintentando...`, lastError.message);
    }
  }

  const message = lastError?.message ?? "Error al procesar el PDF.";
  console.error("Error Pipeline (tras reintentos):", message);
  return { success: false, message };
}

async function runLlamaParsePipeline(
  file: File,
  llamaKey: string
): Promise<{ success: true; markdown: string } | { success: false; message?: string }> {
  try {
    console.log("═══════════════════════════════════════════════════");
    console.log("🚀 INICIANDO PROCESO CON LLAMAPARSE");
    console.log("═══════════════════════════════════════════════════");
    console.log(`📄 Archivo: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    // Paso 1: Subir Archivo
    console.log("\n📤 [1/3] Subiendo archivo a LlamaParse...");
    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const uploadRes = await fetch(`${LLAMA_API_URL}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${llamaKey}` },
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text();
      let errMsg = `Error al subir el PDF (${uploadRes.status}).`;
      try {
        const errJson = JSON.parse(errBody);
        if (errJson.detail || errJson.message) errMsg += ` ${errJson.detail || errJson.message}`;
      } catch {
        if (errBody && errBody.length < 300) errMsg += ` ${errBody}`;
      }
      throw new Error(errMsg);
    }
    const uploadData = await uploadRes.json();
    const jobId = uploadData.id ?? uploadData.job_id;
    if (!jobId) {
      console.error("Respuesta de upload:", uploadData);
      throw new Error("LlamaParse no devolvió un ID de trabajo.");
    }
    console.log(`✅ Archivo subido exitosamente. Job ID: ${jobId}`);

    // Paso 2: Polling (Esperar a que termine)
    console.log("\n⏳ [2/3] LlamaParse está procesando el PDF...");
    console.log("   (Puede tardar hasta 1–2 minutos en PDFs largos)");
    let markdown = "";
    let attempts = 0;
    const maxAttempts = 90; // ~90 segundos para PDFs complejos o largos
    
    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000)); // Esperar 1 seg
      attempts++;
      
      const checkRes = await fetch(`${LLAMA_API_URL}/job/${jobId}`, {
         headers: { Authorization: `Bearer ${llamaKey}` },
      });
      const jobData = await checkRes.json();
      
      // Log del estado actual
      if (jobData.status && jobData.status !== "SUCCESS" && jobData.status !== "FAILED") {
        console.log(`   ⏳ Intento ${attempts}/${maxAttempts} - Estado: ${jobData.status}...`);
      }
      
      if (jobData.status === "SUCCESS") {
        console.log(`\n✅ ¡LlamaParse completó el procesamiento! (${attempts} segundos)`);

        // Paso 3: Obtener Markdown
        console.log("📥 [3/3] Descargando resultado en formato Markdown...");
        const resultRes = await fetch(`${LLAMA_API_URL}/job/${jobId}/result/markdown`, {
          headers: { Authorization: `Bearer ${llamaKey}` },
        });
        if (!resultRes.ok) {
          const errText = await resultRes.text();
          throw new Error(`Error al obtener el resultado (${resultRes.status}). ${errText.slice(0, 200)}`);
        }
        const contentType = resultRes.headers.get("content-type") || "";
        let resultData: { markdown?: string; md?: string; pages?: { md?: string }[] };
        if (contentType.includes("application/json")) {
          resultData = await resultRes.json();
          markdown =
            resultData.markdown ??
            resultData.md ??
            (Array.isArray((resultData as { pages?: { md?: string }[] }).pages)
              ? (resultData as { pages: { md?: string }[] }).pages.map((p) => p.md ?? "").join("\n\n")
              : "") ??
            "";
        } else {
          markdown = await resultRes.text();
        }
        if (typeof markdown !== "string") markdown = "";
        console.log("✅ Markdown descargado exitosamente");
        break;
      } else if (jobData.status === "FAILED") {
        const reason =
          (jobData as { error?: string; message?: string; failure_reason?: string }).error ??
          (jobData as { error?: string; message?: string }).message ??
          (jobData as { failure_reason?: string }).failure_reason;
        throw new Error(
          reason
            ? `LlamaParse no pudo procesar este PDF: ${reason}`
            : "LlamaParse no pudo procesar este PDF. Si es un escaneo, prueba con un PDF que tenga texto seleccionable o con otra herramienta de OCR."
        );
      }
    }

    if (!markdown) {
      throw new Error(
        "The document is still being processed. PDFs with many pages or complex layouts can take over a minute. Please try again in a moment, or try with a shorter PDF."
      );
    }
    
    console.log("\n═══════════════════════════════════════════════════");
    console.log("📝 TEXTO EXTRAÍDO POR LLAMAPARSE");
    console.log("═══════════════════════════════════════════════════");
    console.log(`📊 Longitud total: ${markdown.length} caracteres`);
    console.log(`📄 Primeros 200 caracteres:`);
    console.log("─".repeat(50));
    console.log(markdown.substring(0, 200));
    console.log("─".repeat(50));

    if (markdown.length < 50) {
      return { success: false, message: 'El PDF no contiene suficiente texto legible.' };
    }

    // Guardar el markdown en un archivo físico
    console.log("\n💾 Guardando markdown en archivo local...");
    const debugFilePath = join(process.cwd(), 'debug_extraction.md');
    await writeFile(debugFilePath, markdown, 'utf-8');
    console.log(`✅ Archivo guardado exitosamente en:`);
    console.log(`   📁 ${debugFilePath}`);
    console.log(`   📊 Tamaño: ${(markdown.length / 1024).toFixed(2)} KB`);

    // Paso 4: Análisis con Gemini (COMENTADO - Ya no se usa por ahora)
    /*
    console.log("--- 2. ANALIZANDO CON GEMINI ---");
    const genAI = new GoogleGenerativeAI(googleKey);
    
    const prompt = `
      Actúa como asistente médico. Analiza este expediente (Markdown) y extrae un JSON.
      
      REGLAS:
      - Devuelve SOLO un JSON válido.
      - Si hay tablas en el markdown, interprétalas correctamente.
      - Si el texto NO parece un documento médico (es una tarea escolar, una factura de luz, o texto sin sentido), marca "is_medical_record" como false.
      
      ESTRUCTURA JSON:
      {
        "is_medical_record": boolean,
        "summary": "Resumen breve",
        "detected_diagnosis": "Diagnóstico principal",
        "missing_info_warnings": ["Datos faltantes"]
      }

      DOCUMENTO:
      ${markdown.substring(0, 50000)}
    `;

    let model;
    let result;
    
    try {
      console.log("Intentando con gemini-1.5-flash-latest...");
      model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      result = await model.generateContent(prompt);
    } catch (e: any) {
      console.warn("Flash falló, intentando con gemini-pro...", e.message);
      model = genAI.getGenerativeModel({ model: "gemini-pro" });
      result = await model.generateContent(prompt);
    }

    let text = result.response.text();

    // Limpieza
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
       text = text.substring(firstBrace, lastBrace + 1);
    }

    const analysis = JSON.parse(text);
    
    // Validar que tenga la estructura esperada
    const validatedAnalysis = {
      is_medical_record: analysis.is_medical_record !== undefined ? analysis.is_medical_record : true,
      summary: analysis.summary || 'No se pudo generar un resumen.',
      detected_diagnosis: analysis.detected_diagnosis || 'No especificado',
      missing_info_warnings: Array.isArray(analysis.missing_info_warnings) 
        ? analysis.missing_info_warnings 
        : []
    };

    console.log("¡Análisis Exitoso!");

    return { 
      success: true, 
      analysis: validatedAnalysis 
    };
    */

    // Devolver el markdown directamente
    console.log("\n═══════════════════════════════════════════════════");
    console.log("✨ PROCESO COMPLETADO EXITOSAMENTE");
    console.log("═══════════════════════════════════════════════════");
    console.log("✅ LlamaParse extrajo el texto correctamente");
    console.log("✅ Archivo markdown guardado en la raíz del proyecto");
    console.log("✅ Markdown listo para ser devuelto al cliente");
    console.log("═══════════════════════════════════════════════════\n");

    return { 
      success: true, 
      markdown: markdown 
    };

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error procesando documento.";
    console.error("Error Pipeline:", message);
    return { success: false, message };
  }
}
