import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const ALLOWED_ORIGINS = [
  "https://id-preview--bbac1346-2bfd-4c26-96a8-b78c3bf64d65.lovable.app",
  "https://comparacionanalisisfinanciero.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SHEETS = 20;
const MAX_CELLS_PER_SHEET = 5000;

function validateFileType(buffer: ArrayBuffer, _expectedType: "docx" | "excel"): boolean {
  const uint8 = new Uint8Array(buffer);
  if (uint8.length < 4) return false;
  return uint8[0] === 0x50 && uint8[1] === 0x4B && uint8[2] === 0x03 && uint8[3] === 0x04;
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  if (!validateFileType(buffer, "docx")) {
    throw new Error("Invalid DOCX file format");
  }
  const uint8 = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const raw = decoder.decode(uint8);
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>(.*?)<\/w:t>/gs;
  let match;
  let matchCount = 0;
  while ((match = regex.exec(raw)) !== null) {
    textParts.push(match[1]);
    matchCount++;
    if (matchCount > 50000) break;
  }
  if (textParts.length > 0) {
    return textParts.join(" ").slice(0, 50000);
  }
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000);
}

function parseExcel(buffer: ArrayBuffer): { sheets: { name: string; data: Record<string, string>[]; rawCells: Record<string, string> }[] } {
  if (!validateFileType(buffer, "excel")) {
    throw new Error("Invalid Excel file format");
  }
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetNames = workbook.SheetNames.slice(0, MAX_SHEETS);
  const sheets = sheetNames.map((name: string) => {
    try {
      const sheet = workbook.Sheets[name];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, string>[];
      const rawCells: Record<string, string> = {};
      const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
      let cellCount = 0;
      for (let r = range.s.r; r <= range.e.r && cellCount < MAX_CELLS_PER_SHEET; r++) {
        for (let c = range.s.c; c <= range.e.c && cellCount < MAX_CELLS_PER_SHEET; c++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          const cell = sheet[addr];
          if (cell && cell.v !== undefined && cell.v !== "") {
            rawCells[addr] = String(cell.v).slice(0, 1000);
            cellCount++;
          }
        }
      }
      return { name, data, rawCells };
    } catch (sheetError) {
      console.error(`[INTERNAL] Failed to parse sheet "${name}":`, sheetError);
      return { name, data: [], rawCells: {} };
    }
  });
  return { sheets };
}

function summarizeExcel(excelData: { sheets: { name: string; rawCells: Record<string, string> }[] }): string {
  const sheetNames = excelData.sheets.map(s => s.name);
  const header = `[${excelData.sheets.length} sheet(s): ${sheetNames.map((n, i) => `#${i + 1} "${n}"`).join(", ")}]\n\n`;
  const details = excelData.sheets.map((s, i) => {
    const cellEntries = Object.entries(s.rawCells).slice(0, 200);
    return `Sheet #${i + 1} "${s.name}" (${Object.keys(s.rawCells).length} cells):\n${cellEntries.map(([cell, val]) => `  ${cell}: ${val}`).join("\n")}`;
  }).join("\n\n");
  return header + details;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticación requerida. / Authentication required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sesión inválida. / Invalid session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const mode = formData.get("mode") as string;
    const primaryLang = (formData.get("primaryLang") as string) || "es";
    const docType = formData.get("docType") as string;
    const langPair = (formData.get("langPair") as string) || "es-en";

    // Files come as file1, file2, file3, file4 from the frontend
    const file1 = formData.get("file1") as File | null;
    const file2 = formData.get("file2") as File | null;
    const file3 = formData.get("file3") as File | null;
    const file4 = formData.get("file4") as File | null;

    let systemPrompt: string;
    let userContent: string;

    if (mode === "translation") {
      // Translation mode: 4 files (Excel ES, Excel EN, Word ES, Word EN)
      if (!file1 || !file2 || !file3 || !file4) {
        return new Response(
          JSON.stringify({ error: "Se requieren los 4 archivos. / All 4 files are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allFiles = [file1, file2, file3, file4];
      for (const file of allFiles) {
        if (file.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: "Archivo demasiado grande. Máximo 10MB. / File too large. Maximum 10MB." }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // file1=Excel ES, file2=Excel EN, file3=Word ES, file4=Word EN
      const [excel1Data, excel2Data, word1Text, word2Text] = await Promise.all([
        file1.arrayBuffer().then(parseExcel),
        file2.arrayBuffer().then(parseExcel),
        file3.arrayBuffer().then(parseDocx),
        file4.arrayBuffer().then(parseDocx),
      ]);

      const excel1Summary = summarizeExcel(excel1Data);
      const excel2Summary = summarizeExcel(excel2Data);

      const primaryFile = primaryLang === "es" ? "File 1 (ES)" : "File 2 (EN)";
      const targetLang = primaryLang === "es" ? "English" : "Spanish";
      const targetFile = primaryLang === "es" ? "File 2 (EN)" : "File 1 (ES)";

      systemPrompt = `You are a bilingual (Spanish/English) financial document comparison expert.
The PRIMARY file is: ${primaryFile}. The translation target language is ${targetLang}.
Compare the documents for TRANSLATION accuracy. The primary file is the source of truth.
All discrepancies should show what the ${targetLang} translation SHOULD be based on the primary file.

IMPORTANT - SHEET/TAB MATCHING FOR EXCEL FILES (use this 3-level strategy in order):
1. MATCH BY NAME: Try to match sheets by their name or translated name (e.g. "Balance General" ↔ "Balance Sheet", "Estado de Resultados" ↔ "Income Statement").
2. MATCH BY ORDER: If names don't match, match by position (Sheet #1 vs Sheet #1, Sheet #2 vs Sheet #2, etc.).
3. MATCH BY CONTENT: If neither name nor order produces a reasonable match, analyze the DATA STRUCTURE and VALUES inside each sheet. Look for similar column headers, row labels, numerical patterns, and financial categories to find the best content match. For example, a sheet with rows like "Activos/Pasivos/Patrimonio" clearly matches one with "Assets/Liabilities/Equity" regardless of sheet name.
- In your summary, explain HOW each sheet pair was matched (by name, content, or order).
- If a sheet exists in one file but has NO counterpart in the other (even after content analysis), report it as a "missing_sheet" discrepancy with severity "major".
- Always include the SHEET NAME in every sourceLocation and targetLocation.

For EVERY discrepancy found, you MUST provide:
1. The original text in the primary file and its location (file name, sheet name, cell reference if Excel, or page/section if Word)
2. The translated text found in ${targetFile} and its location
3. What the correct ${targetLang} translation should be
4. Severity: "critical" (numbers/amounts wrong), "major" (meaning changed), "minor" (style/preference)

Return your analysis as a JSON object:
{
  "summary": "Brief overall assessment in Spanish and English. Include how many sheets were found in each file and how they were matched.",
  "totalDiscrepancies": number,
  "baseFile": "${primaryFile}",
  "discrepancies": [
    {
      "id": number,
      "type": "mistranslation" | "missing" | "inconsistent" | "number_mismatch" | "missing_sheet",
      "severity": "critical" | "major" | "minor",
      "sourceFile": "${primaryFile}",
      "sourceLocation": "Sheet 'SheetName', Cell Y" or "Section/paragraph description",
      "sourceText": "original text in primary language",
      "targetFile": "${targetFile}",
      "targetLocation": "Sheet 'SheetName', Cell Y" or "Section/paragraph description",
      "targetText": "translated text found",
      "correctTranslation": "what the correct ${targetLang} translation should be",
      "explanation": "Brief explanation in Spanish and English"
    }
  ]
}`;

      userContent = `## Excel File 1 (ES) - "${file1.name}"
${excel1Summary}

## Excel File 2 (EN) - "${file2.name}"
${excel2Summary}

## Word File 1 (ES) - "${file3.name}"
${word1Text.slice(0, 15000)}

## Word File 2 (EN) - "${file4.name}"
${word2Text.slice(0, 15000)}`;

    } else if (mode === "data") {
      // Data mode: 2 files of same type
      if (!file1 || !file2) {
        return new Response(
          JSON.stringify({ error: "Se requieren 2 archivos. / 2 files are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const file of [file1, file2]) {
        if (file.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: "Archivo demasiado grande. Máximo 10MB. / File too large. Maximum 10MB." }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Determine language labels from langPair
      const langLabels: Record<string, { l1: string; l2: string }> = {
        "es-en": { l1: "ES", l2: "EN" },
        "es-es": { l1: "ES", l2: "ES" },
        "en-en": { l1: "EN", l2: "EN" },
      };
      const labels = langLabels[langPair] || { l1: "File 1", l2: "File 2" };

      let file1Content: string;
      let file2Content: string;

      if (docType === "excel") {
        const [data1, data2] = await Promise.all([
          file1.arrayBuffer().then(parseExcel),
          file2.arrayBuffer().then(parseExcel),
        ]);
        file1Content = summarizeExcel(data1);
        file2Content = summarizeExcel(data2);
      } else {
        // Word
        const [text1, text2] = await Promise.all([
          file1.arrayBuffer().then(parseDocx),
          file2.arrayBuffer().then(parseDocx),
        ]);
        file1Content = text1.slice(0, 20000);
        file2Content = text2.slice(0, 20000);
      }

      const needsTranslation = langPair === "es-en";
      const primaryFileLabel = `File 1 (${labels.l1})`;
      const targetFileLabel = `File 2 (${labels.l2})`;

      systemPrompt = `You are a bilingual (Spanish/English) financial data comparison expert.
Compare these two ${docType === "excel" ? "Excel" : "Word"} files for DATA accuracy.
File 1 is in ${labels.l1 === "ES" ? "Spanish" : "English"}, File 2 is in ${labels.l2 === "ES" ? "Spanish" : "English"}.
${needsTranslation ? "Translate labels/headers when comparing across languages." : "Both files are in the same language."}
File 1 is the PRIMARY/base file (source of truth).

${docType === "excel" ? `IMPORTANT - SHEET/TAB MATCHING FOR EXCEL FILES:
IMPORTANT - SHEET/TAB MATCHING FOR EXCEL FILES (use this 3-level strategy in order):
1. MATCH BY NAME: Try to match sheets by their name or translated name (e.g. "Balance General" ↔ "Balance Sheet").
1. MATCH BY NAME: Try to match sheets by their name or translated name (e.g. "Balance General" ↔ "Balance Sheet").
2. MATCH BY ORDER: If names don't match, match by position (Sheet #1 vs Sheet #1, Sheet #2 vs Sheet #2, etc.).
3. MATCH BY CONTENT: If neither name nor order produces a reasonable match, analyze the DATA STRUCTURE and VALUES inside each sheet. Look for similar column headers, row labels, numerical patterns, and financial categories to find the best content match.
- In your summary, explain HOW each sheet pair was matched (by name, content, or order).
- If a sheet exists in one file but has NO counterpart in the other (even after content analysis), report it as a "missing_data" discrepancy with severity "major".
- Always include the SHEET NAME in every sourceLocation and targetLocation.
` : ""}
For EVERY data discrepancy found, provide:
1. The data value in File 1 and its exact location (include sheet name for Excel)
2. The corresponding data in File 2 and its exact location
3. What the expected value should be
4. Severity: "critical" (financial amounts differ), "major" (key data differs), "minor" (formatting/rounding)

Return your analysis as a JSON object:
{
  "summary": "Brief overall assessment in Spanish and English.${docType === "excel" ? " Include how many sheets were found in each file and how they were matched." : ""}",
  "baseFile": "${primaryFileLabel}",
  "totalDiscrepancies": number,
  "discrepancies": [
    {
      "id": number,
      "type": "value_mismatch" | "missing_data" | "extra_data" | "format_difference",
      "severity": "critical" | "major" | "minor",
      "sourceFile": "${primaryFileLabel}",
      "sourceLocation": "Sheet 'SheetName', Cell Y" or "Section/paragraph",
      "sourceValue": "value in primary file",
      "targetFile": "${targetFileLabel}",
      "targetLocation": "Sheet 'SheetName', Cell Y" or "Section/paragraph",
      "targetValue": "value in comparison file",
      "expectedValue": "what the correct value should be",
      "explanation": "Brief explanation in Spanish and English"
    }
  ]
}`;

      userContent = `## ${primaryFileLabel} - "${file1.name}"
${file1Content}

## ${targetFileLabel} - "${file2.name}"
${file2Content}`;

    } else {
      return new Response(
        JSON.stringify({ error: "Modo de comparación inválido. / Invalid comparison mode." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intente más tarde. / Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. / Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("[INTERNAL] AI error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "Error al procesar documentos. / Error processing documents." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { summary: content, totalDiscrepancies: 0, discrepancies: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[INTERNAL] compare-documents error:", e);
    return new Response(
      JSON.stringify({ error: "Error al comparar documentos. / Error comparing documents." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
