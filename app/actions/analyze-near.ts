'use server'

import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Tipos para la respuesta de la API de NEAR AI
 */
type NearAIResponse = {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
  };
};

/** Estructura que debe devolver el LLM para llenar el paso 3 */
export type NearReport = {
  summary: string;
  keyItems: string[];
  nextSteps: string[];
  questions: string[];
  extraInfo?: string;
};

type AnalyzeNearResult = {
  success: boolean;
  report?: NearReport;
  error?: string;
};

/** Convierte newlines literales dentro de strings JSON en \\n para que JSON.parse no falle */
function fixNewlinesInJsonStrings(s: string): string {
  let result = "";
  let inString = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"') {
      let back = 0;
      let j = i - 1;
      while (j >= 0 && s[j] === "\\") {
        back++;
        j--;
      }
      if (back % 2 === 0) inString = !inString;
      result += c;
      i++;
      continue;
    }
    if (inString && (c === "\n" || c === "\r")) {
      result += "\\n";
      if (c === "\r" && s[i + 1] === "\n") i++;
      i++;
      continue;
    }
    result += c;
    i++;
  }
  return result;
}

/** Extrae el primer objeto JSON con llaves balanceadas (por si hay texto extra) */
function extractBalancedJson(text: string): string {
  const start = text.indexOf("{");
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let escape = false;
  let quote = "";
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inString) {
      escape = true;
      continue;
    }
    if ((c === '"' || c === "'") && !inString) {
      inString = true;
      quote = c;
      continue;
    }
    if (c === quote) {
      inString = false;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
}

/** Cuando JSON.parse falla (p. ej. respuesta truncada), intenta extraer campos del texto con regex */
function extractReportFromText(raw: string): NearReport | null {
  // Summary: primero intentar string cerrado; si no (truncado), capturar hasta fin de contenido
  let summary = "";
  const summaryMatch = raw.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (summaryMatch) {
    summary = unescapeJsonString(summaryMatch[1]);
  } else {
    const truncatedSummary = raw.match(/"summary"\s*:\s*"([\s\S]*)$/);
    if (truncatedSummary) summary = unescapeJsonString(truncatedSummary[1]);
  }

  const extraMatch = raw.match(/"extraInfo"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  let extraInfo: string | undefined;
  if (extraMatch) {
    extraInfo = unescapeJsonString(extraMatch[1]) || undefined;
  } else {
    const truncatedExtra = raw.match(/"extraInfo"\s*:\s*"([\s\S]*)$/);
    if (truncatedExtra) extraInfo = unescapeJsonString(truncatedExtra[1]) || undefined;
  }

  const keyItems: string[] = [];
  const keyArrMatch = raw.match(/"keyItems"\s*:\s*\[([\s\S]*?)\]/);
  if (keyArrMatch) {
    const arrContent = keyArrMatch[1];
    const strMatches = arrContent.matchAll(/"((?:[^"\\]|\\.)*)"/g);
    for (const m of strMatches) keyItems.push(m[1].replace(/\\"/g, '"'));
  }

  const nextSteps: string[] = [];
  const nextArrMatch = raw.match(/"nextSteps"\s*:\s*\[([\s\S]*?)\]/);
  if (nextArrMatch) {
    const arrContent = nextArrMatch[1];
    const strMatches = arrContent.matchAll(/"((?:[^"\\]|\\.)*)"/g);
    for (const m of strMatches) nextSteps.push(m[1].replace(/\\"/g, '"'));
  }

  const questions: string[] = [];
  const qArrMatch = raw.match(/"questions"\s*:\s*\[([\s\S]*?)\]/);
  if (qArrMatch) {
    const arrContent = qArrMatch[1];
    const strMatches = arrContent.matchAll(/"((?:[^"\\]|\\.)*)"/g);
    for (const m of strMatches) questions.push(m[1].replace(/\\"/g, '"'));
  }

  if (!summary && keyItems.length === 0 && nextSteps.length === 0 && questions.length === 0) return null;
  return {
    summary: summary || "Summary could not be extracted from the response.",
    keyItems: keyItems.length > 0 ? keyItems : ["Review the lab values with your clinician.", "Note any out-of-range results."],
    nextSteps: nextSteps.length > 0 ? nextSteps : ["Discuss these results with your doctor.", "Keep a copy for your records."],
    questions: questions.length > 0 ? questions : ["Which results need follow-up?", "Are any medications affecting these values?"],
    extraInfo,
  };
}

/**
 * Modelo de NEAR AI a usar (fácil de cambiar)
 * 
 * Modelo económico seleccionado para pruebas:
 * - openai/gpt-oss-120b: Modelo de código abierto, muy económico
 * - Alternativa: fireworks/llama-v3-70b-instruct
 * 
 * 💰 Costo aproximado: $0.15 USD por millón de tokens
 * Esto permite hacer pruebas sin gastar mucho saldo.
 */
const MODEL_ID = "openai/gpt-oss-120b";

/**
 * Endpoint base de la API de NEAR AI Cloud
 * ✅ VERIFICACIÓN: https://cloud-api.near.ai/v1/chat/completions
 */
const NEAR_AI_API_URL = "https://cloud-api.near.ai/v1/chat/completions";

/**
 * Ruta del archivo markdown local generado por LlamaParse
 */
const DEBUG_EXTRACTION_PATH = join(process.cwd(), 'debug_extraction.md');

/**
 * Analiza el documento markdown local usando la API de NEAR AI
 *
 * Lee el archivo debug_extraction.md, lo envía a NEAR AI y devuelve la respuesta.
 * Si se proporciona diagnosisText, se incluye en el prompt para que la IA lo tenga en cuenta.
 *
 * @param diagnosisText - Texto opcional con el diagnóstico o notas del paciente (paso 2 del wizard)
 * @param locale - Idioma para la respuesta: 'es' (español) o 'en' (inglés). Por defecto 'en'.
 * @returns Resultado del análisis con el contenido de la respuesta o error
 */
export async function analyzeWithNearAI(
  diagnosisText?: string,
  locale?: "es" | "en"
): Promise<AnalyzeNearResult> {
  const outputLang = locale === "es" ? "Spanish" : "English";
  const rejectionLang = locale === "es" ? "Spanish" : "English";
  // ✅ VERIFICACIÓN: Validar API Key
  const apiKey = process.env.NEAR_AI_API_KEY;
  if (!apiKey) {
    console.error("❌ Error: NEAR_AI_API_KEY no está configurada");
    return {
      success: false,
      error: "API Key de NEAR AI no configurada. Por favor, configura NEAR_AI_API_KEY en tu archivo .env"
    };
  }

  try {
    console.log("═══════════════════════════════════════════════════");
    console.log("🚀 INICIANDO ANÁLISIS CON NEAR AI");
    console.log("═══════════════════════════════════════════════════");

    // Paso 1: Leer el archivo markdown local
    console.log("\n📂 [1/3] Leyendo archivo debug_extraction.md...");
    console.log(`   Ruta: ${DEBUG_EXTRACTION_PATH}`);

    let markdownContent: string;
    try {
      markdownContent = await readFile(DEBUG_EXTRACTION_PATH, 'utf-8');
    } catch (fileError: any) {
      if (fileError.code === 'ENOENT') {
        console.error("❌ El archivo debug_extraction.md no existe");
        return {
          success: false,
          error: "El archivo debug_extraction.md no existe. Por favor, primero extrae el PDF con LlamaParse."
        };
      }
      throw fileError;
    }

    // Validar que el contenido no esté vacío
    if (!markdownContent || markdownContent.trim().length === 0) {
      console.error("❌ El archivo debug_extraction.md está vacío");
      return {
        success: false,
        error: "El archivo debug_extraction.md está vacío. Por favor, verifica que LlamaParse haya extraído el contenido correctamente."
      };
    }

    console.log(`✅ Archivo leído exitosamente (${markdownContent.length} caracteres)`);
    if (diagnosisText?.trim()) {
      console.log(`📋 Diagnóstico/notas del paciente incluido (${diagnosisText.trim().length} caracteres)`);
    }

    // Paso 2: Construir el payload JSON
    console.log("\n📦 [2/3] Construyendo payload para NEAR AI...");
    console.log(`   Modelo: ${MODEL_ID}`);

    const SYSTEM_PROMPT = `
You are a Medical Assistant expert in interpreting clinical and lab results. Your task has two phases: VALIDATION and, only when valid, ANALYSIS.

## PHASE 1 – VALIDATION (mandatory)

Before analyzing, you MUST decide if the content is acceptable:

1) **Document**: The main document MUST be a **patient blood/lab analysis** (laboratory results: biomarkers, reference ranges, CBC, chemistry panel, lipids, etc.). Reject and set isRelevantLabReport to false if the document is:
   - Not medical (invoice, receipt, contract, form, school work, article, recipe, random text).
   - Medical but not blood/lab results (e.g. imaging report only, prescription only, clinical note without lab values).
   - Clearly not from a human patient (e.g. veterinary, research data without context).

2) **Diagnosis/notes** (if the user provided "Patient diagnosis or notes"): That text MUST be relevant to a patient's health or clinical context (e.g. diagnosis, symptoms, medical history, current condition). Reject and set isRelevantLabReport to false if it is:
   - Unrelated (recipe, quote, spam, copy-paste of unrelated content).
   - Not about the patient or their health.

If either the document or the diagnosis/notes (when provided) is not acceptable, respond with the same JSON structure but set:
- "isRelevantLabReport": false
- "rejectionReason": a short message in ${rejectionLang} for the user. Be clear and polite.
- You may leave summary, keyItems, nextSteps, questions, and extraInfo as empty strings or empty arrays.

## PHASE 2 – ANALYSIS (only when isRelevantLabReport is true)

When the document IS a patient blood/lab analysis and any provided diagnosis/notes ARE relevant:
- Set "isRelevantLabReport": true
- Set "rejectionReason": ""
- Fill summary, keyItems, nextSteps, questions, and extraInfo as below. Write ALL analysis content (summary, keyItems, nextSteps, questions, extraInfo) in ${outputLang}.

RULES for analysis:
- Do NOT describe the document (e.g. "the document has a header"). Get to the point.
- DETECT abnormal values and compare them to reference ranges when available.
- SYNTHESIZE: group related abnormal values into a logical interpretation.
- When the user provided "Patient diagnosis or notes", use that context to tailor your summary, key items, next steps, and questions.

Respond with ONLY a valid JSON object, no \`\`\` or text before or after. Use double quotes, escape strings properly. No trailing commas. Use \\n for line breaks inside long strings.

{
  "isRelevantLabReport": true or false,
  "rejectionReason": "empty string when true; short message in ${rejectionLang} when false",
  "summary": "2-4 sentences in ${outputLang} when valid; empty string when rejected",
  "keyItems": ["Item 1", "Item 2", "Item 3"],
  "nextSteps": ["Next step 1", "Next step 2", "Next step 3"],
  "questions": ["Question 1", "Question 2", "Question 3"],
  "extraInfo": "Optional free text in ${outputLang} when valid; empty string when rejected"
}
`;

    const diagnosisBlock = diagnosisText?.trim()
      ? `Patient diagnosis or notes:\n\n${diagnosisText.trim()}\n\n---\n\nLab document:\n\n`
      : "";
    const userContent = `${diagnosisBlock}${diagnosisBlock ? "" : "Analiza el siguiente documento:\n\n"}${markdownContent}`;

    const payload = {
      model: MODEL_ID,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT.trim()
        },
        {
          role: "user",
          content: userContent
        }
      ],
      temperature: 0.3,
      max_tokens: 2200
    };

    console.log(`✅ Payload construido (${JSON.stringify(payload).length} bytes)`);

    // Paso 3: Enviar petición a NEAR AI
    console.log("\n🚀 INICIANDO CONEXIÓN A NEAR AI...");
    console.log("\n📦 PAYLOAD JSON GENERADO:");
    console.log(JSON.stringify(payload, null, 2));
    
    console.log(`\n📡 Enviando petición a ${NEAR_AI_API_URL}...`);
    console.log(`   ✅ Bearer Token: ${apiKey.substring(0, 10)}...`);

    const response = await fetch(NEAR_AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    // Manejar errores de la API
    if (!response.ok) {
      console.log(`\n❌ ERROR DE CONEXIÓN: Status ${response.status} ${response.statusText}`);
      
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      
      try {
        const errorData = await response.json();
        console.log("📋 Detalles del error (JSON):");
        console.log(JSON.stringify(errorData, null, 2));
        
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
      } catch {
        // Si no se puede parsear como JSON, usar el texto plano
        const errorText = await response.text();
        console.log("📋 Detalles del error (Texto):");
        console.log(errorText);
        
        if (errorText) {
          errorMessage = errorText;
        }
      }

      console.error(`❌ Error de API: ${errorMessage}`);
      
      // Errores comunes
      if (response.status === 401) {
        return {
          success: false,
          error: `Error de autenticación (401): ${errorMessage}. Verifica que tu API Key sea correcta.`
        };
      }
      if (response.status === 402) {
        return {
          success: false,
          error: `Error de pago (402): ${errorMessage}. Verifica que tengas saldo suficiente en tu cuenta de NEAR AI.`
        };
      }

      return {
        success: false,
        error: `Error de API (${response.status}): ${errorMessage}`
      };
    }

    // Parsear la respuesta exitosa
    console.log(`\n✅ RESPUESTA RECIBIDA (Status: ${response.status})`);
    
    const data: NearAIResponse = await response.json();
    
    console.log("📥 Respuesta parseada exitosamente");

    // Extraer el contenido del mensaje
    if (!data.choices || data.choices.length === 0) {
      return {
        success: false,
        error: "La API no devolvió ninguna respuesta"
      };
    }

    const content = data.choices[0].message.content;

    if (!content || !content.trim()) {
      return {
        success: false,
        error: "La respuesta de la API está vacía"
      };
    }

    // Extraer JSON (puede venir dentro de ``` ... ``` o en bruto, con texto antes/después)
    let jsonStr = content.trim();
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }
    jsonStr = extractBalancedJson(jsonStr);

    // Sanitizar: comas finales y saltos de línea dentro de strings (el modelo a veces los pone literales)
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    jsonStr = fixNewlinesInJsonStrings(jsonStr);
    jsonStr = jsonStr.replace(/[\u0000-\u001F]/g, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : ' '));

    const REJECTION_DEFAULT_MESSAGE =
      "Este contenido no parece ser un análisis de sangre de un paciente, o las notas no están relacionadas. Por favor sube un reporte de laboratorio (PDF) y, si usas diagnóstico, que sea relevante a la salud del paciente.";

    let report: NearReport;
    try {
      const parsed = JSON.parse(jsonStr);

      if (parsed.isRelevantLabReport === false) {
        const reason =
          typeof parsed.rejectionReason === "string" && parsed.rejectionReason.trim()
            ? parsed.rejectionReason.trim()
            : REJECTION_DEFAULT_MESSAGE;
        console.log("🚫 Contenido rechazado por la IA (no es análisis de sangre / no relacionado):", reason);
        return {
          success: false,
          error: reason,
        };
      }

      report = {
        summary: typeof parsed.summary === "string" ? parsed.summary : "",
        keyItems: Array.isArray(parsed.keyItems) ? parsed.keyItems.filter((x: unknown) => typeof x === "string") : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps.filter((x: unknown) => typeof x === "string") : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions.filter((x: unknown) => typeof x === "string") : [],
        extraInfo: typeof parsed.extraInfo === "string" ? parsed.extraInfo : undefined,
      };
    } catch (parseError) {
      console.warn("JSON.parse failed, trying repair and fallback:", parseError);
      // Intentar reparar JSON truncado (string sin cerrar): añadir " y }
      let repaired: unknown = null;
      if (!jsonStr.trim().endsWith("}")) {
        try {
          const tryParse = JSON.parse(jsonStr.trimEnd() + '"}\n');
          repaired = tryParse;
        } catch {
          // ignore
        }
      }
      if (repaired && typeof repaired === "object" && repaired !== null) {
        const p = repaired as Record<string, unknown>;
        if (p.isRelevantLabReport === false) {
          const reason =
            typeof p.rejectionReason === "string" && (p.rejectionReason as string).trim()
              ? (p.rejectionReason as string).trim()
              : REJECTION_DEFAULT_MESSAGE;
          return { success: false, error: reason };
        }
        report = {
          summary: typeof p.summary === "string" ? p.summary : "",
          keyItems: Array.isArray(p.keyItems) ? p.keyItems.filter((x: unknown) => typeof x === "string") : [],
          nextSteps: Array.isArray(p.nextSteps) ? p.nextSteps.filter((x: unknown) => typeof x === "string") : [],
          questions: Array.isArray(p.questions) ? p.questions.filter((x: unknown) => typeof x === "string") : [],
          extraInfo: typeof p.extraInfo === "string" ? p.extraInfo : undefined,
        };
        console.log("Repaired truncated JSON and built report.");
      } else {
        const fallback = extractReportFromText(content);
        if (fallback) {
          console.log("Fallback extraction succeeded, using extracted report.");
          report = fallback;
        } else {
          console.error("Contenido recibido (primeros 800 chars):", content.slice(0, 800));
          return {
            success: false,
            error: "The model response could not be read as valid data. Please try again."
          };
        }
      }
    }

    console.log("\n✅ Análisis completado exitosamente");
    if (data.usage) {
      console.log(`📊 Tokens usados: ${data.usage.total_tokens}`);
    }
    console.log("═══════════════════════════════════════════════════\n");

    return {
      success: true,
      report
    };

  } catch (error: any) {
    console.error("\n❌ ERROR DE CONEXIÓN:");
    console.error("   Tipo:", error.constructor.name);
    console.error("   Mensaje:", error.message);
    console.error("   Stack:", error.stack);
    
    // Manejar diferentes tipos de errores
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error("   🔍 Diagnóstico: Error de red/fetch");
      return {
        success: false,
        error: "Error de conexión con la API de NEAR AI. Verifica tu conexión a internet."
      };
    }

    return {
      success: false,
      error: error.message || "Error desconocido al analizar el documento"
    };
  }
}
