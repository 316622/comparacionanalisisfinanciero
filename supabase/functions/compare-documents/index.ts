import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_SHEETS = 20;
const MAX_CELLS_PER_SHEET = 50000;

function validateFileType(buffer: ArrayBuffer): boolean {
  const uint8 = new Uint8Array(buffer);
  if (uint8.length < 4) return false;
  return uint8[0] === 0x50 && uint8[1] === 0x4B && uint8[2] === 0x03 && uint8[3] === 0x04;
}

async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  if (!validateFileType(buffer)) throw new Error("Invalid DOCX file format");
  const uint8 = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const raw = decoder.decode(uint8);
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>(.*?)<\/w:t>/gs;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    textParts.push(match[1]);
  }
  if (textParts.length > 0) return textParts.join(" ");
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

interface SheetData {
  name: string;
  data: Record<string, string>[];
  rawCells: Record<string, string>;
}

function parseExcel(buffer: ArrayBuffer): { sheets: SheetData[] } {
  if (!validateFileType(buffer)) throw new Error("Invalid Excel file format");
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
            rawCells[addr] = String(cell.v);
            cellCount++;
          }
        }
      }
      return { name, data, rawCells };
    } catch (sheetError) {
      console.error(`Failed to parse sheet "${name}":`, sheetError);
      return { name, data: [], rawCells: {} };
    }
  });
  return { sheets };
}

function summarizeExcel(excelData: { sheets: SheetData[] }): string {
  const sheetNames = excelData.sheets.map(s => s.name);
  const header = `[${excelData.sheets.length} sheet(s): ${sheetNames.map((n, i) => `#${i + 1} "${n}"`).join(", ")}]\n\n`;
  const details = excelData.sheets.map((s, i) => {
    const cellEntries = Object.entries(s.rawCells);
    return `Sheet #${i + 1} "${s.name}" (${cellEntries.length} cells):\n${cellEntries.map(([cell, val]) => `  ${cell}: ${val}`).join("\n")}`;
  }).join("\n\n");
  return header + details;
}

// ==================== DETERMINISTIC COMPARISON ====================

function normalizeValue(v: string): string {
  // Normalize numbers: remove thousands separators, normalize decimal
  const trimmed = v.trim();
  // Try parsing as number to compare numerically
  const num = Number(trimmed.replace(/,/g, ""));
  if (!isNaN(num) && trimmed !== "") return String(num);
  return trimmed.toLowerCase();
}

function matchSheets(sheets1: SheetData[], sheets2: SheetData[]): Array<{ s1: SheetData | null; s2: SheetData | null; matchMethod: string }> {
  const matched: Array<{ s1: SheetData | null; s2: SheetData | null; matchMethod: string }> = [];
  const used2 = new Set<number>();

  // Pass 1: Match by exact or similar name
  for (const s1 of sheets1) {
    const name1 = s1.name.toLowerCase().trim();
    let bestIdx = -1;
    for (let j = 0; j < sheets2.length; j++) {
      if (used2.has(j)) continue;
      const name2 = sheets2[j].name.toLowerCase().trim();
      if (name1 === name2) { bestIdx = j; break; }
    }
    if (bestIdx >= 0) {
      matched.push({ s1, s2: sheets2[bestIdx], matchMethod: "nombre" });
      used2.add(bestIdx);
    }
  }

  // Pass 2: Match remaining by order
  const unmatched1 = sheets1.filter(s => !matched.some(m => m.s1 === s));
  const unmatched2Indices = sheets2.map((_, i) => i).filter(i => !used2.has(i));
  
  for (let i = 0; i < unmatched1.length; i++) {
    if (i < unmatched2Indices.length) {
      matched.push({ s1: unmatched1[i], s2: sheets2[unmatched2Indices[i]], matchMethod: "orden" });
      used2.add(unmatched2Indices[i]);
    } else {
      matched.push({ s1: unmatched1[i], s2: null, matchMethod: "sin_par" });
    }
  }

  // Remaining sheets in file2 with no match
  for (let j = 0; j < sheets2.length; j++) {
    if (!used2.has(j)) {
      matched.push({ s1: null, s2: sheets2[j], matchMethod: "sin_par" });
    }
  }

  return matched;
}

interface DetDiscrepancy {
  id: number;
  type: "value_mismatch" | "missing_data" | "extra_data" | "format_difference";
  severity: "critical" | "major" | "minor";
  sourceFile: string;
  sourceLocation: string;
  sourceValue: string;
  targetFile: string;
  targetLocation: string;
  targetValue: string;
  expectedValue: string;
  explanation: string;
}

function determineSeverity(val1: string, val2: string): "critical" | "major" | "minor" {
  const n1 = Number(val1.replace(/,/g, ""));
  const n2 = Number(val2.replace(/,/g, ""));
  // If both are numbers, it's a financial data mismatch = critical
  if (!isNaN(n1) && !isNaN(n2) && val1.trim() !== "" && val2.trim() !== "") return "critical";
  // If one is empty = major
  if (val1.trim() === "" || val2.trim() === "") return "major";
  // Text differs
  return "major";
}

function compareExcelDeterministic(
  data1: { sheets: SheetData[] },
  data2: { sheets: SheetData[] },
  file1Label: string,
  file2Label: string
): { summary: string; totalDiscrepancies: number; baseFile: string; discrepancies: DetDiscrepancy[] } {
  const sheetMatches = matchSheets(data1.sheets, data2.sheets);
  const discrepancies: DetDiscrepancy[] = [];
  let discId = 1;
  const matchDescriptions: string[] = [];

  for (const { s1, s2, matchMethod } of sheetMatches) {
    if (!s1 && s2) {
      matchDescriptions.push(`Hoja "${s2.name}" existe solo en ${file2Label}.`);
      discrepancies.push({
        id: discId++, type: "missing_data", severity: "major",
        sourceFile: file1Label, sourceLocation: "(no existe)",
        sourceValue: "(vacío)", targetFile: file2Label,
        targetLocation: `Hoja '${s2.name}'`, targetValue: `${Object.keys(s2.rawCells).length} celdas`,
        expectedValue: "La hoja debería existir en ambos archivos",
        explanation: `La hoja "${s2.name}" existe en ${file2Label} pero no tiene par en ${file1Label}.`,
      });
      continue;
    }
    if (s1 && !s2) {
      matchDescriptions.push(`Hoja "${s1.name}" existe solo en ${file1Label}.`);
      discrepancies.push({
        id: discId++, type: "missing_data", severity: "major",
        sourceFile: file1Label, sourceLocation: `Hoja '${s1.name}'`,
        sourceValue: `${Object.keys(s1.rawCells).length} celdas`, targetFile: file2Label,
        targetLocation: "(no existe)", targetValue: "(vacío)",
        expectedValue: "La hoja debería existir en ambos archivos",
        explanation: `La hoja "${s1.name}" existe en ${file1Label} pero no tiene par en ${file2Label}.`,
      });
      continue;
    }
    if (!s1 || !s2) continue;

    matchDescriptions.push(`Hoja "${s1.name}" ↔ "${s2.name}" (emparejadas por ${matchMethod}).`);

    // Collect all cell addresses from both sheets
    const allCells = new Set([...Object.keys(s1.rawCells), ...Object.keys(s2.rawCells)]);

    for (const addr of allCells) {
      const v1 = s1.rawCells[addr];
      const v2 = s2.rawCells[addr];
      const has1 = v1 !== undefined;
      const has2 = v2 !== undefined;

      if (has1 && has2) {
        // Both have data - compare
        if (normalizeValue(v1) !== normalizeValue(v2)) {
          discrepancies.push({
            id: discId++,
            type: "value_mismatch",
            severity: determineSeverity(v1, v2),
            sourceFile: file1Label,
            sourceLocation: `Hoja '${s1.name}', Celda ${addr}`,
            sourceValue: v1,
            targetFile: file2Label,
            targetLocation: `Hoja '${s2.name}', Celda ${addr}`,
            targetValue: v2,
            expectedValue: v1,
            explanation: `El valor en ${addr} difiere: "${v1}" vs "${v2}".`,
          });
        }
      } else if (has1 && !has2) {
        discrepancies.push({
          id: discId++, type: "missing_data", severity: determineSeverity(v1, ""),
          sourceFile: file1Label, sourceLocation: `Hoja '${s1.name}', Celda ${addr}`,
          sourceValue: v1, targetFile: file2Label,
          targetLocation: `Hoja '${s2.name}', Celda ${addr}`, targetValue: "(vacío)",
          expectedValue: v1,
          explanation: `La celda ${addr} tiene valor "${v1}" en ${file1Label} pero está vacía en ${file2Label}.`,
        });
      } else if (!has1 && has2) {
        discrepancies.push({
          id: discId++, type: "extra_data", severity: determineSeverity("", v2),
          sourceFile: file1Label, sourceLocation: `Hoja '${s1.name}', Celda ${addr}`,
          sourceValue: "(vacío)", targetFile: file2Label,
          targetLocation: `Hoja '${s2.name}', Celda ${addr}`, targetValue: v2,
          expectedValue: "(vacío)",
          explanation: `La celda ${addr} está vacía en ${file1Label} pero tiene valor "${v2}" en ${file2Label}.`,
        });
      }
    }
  }

  const critCount = discrepancies.filter(d => d.severity === "critical").length;
  const majCount = discrepancies.filter(d => d.severity === "major").length;
  const minCount = discrepancies.filter(d => d.severity === "minor").length;

  const summary = [
    `Comparación determinística celda por celda completada.`,
    `Se encontraron ${data1.sheets.length} hoja(s) en ${file1Label} y ${data2.sheets.length} hoja(s) en ${file2Label}.`,
    `Emparejamiento de hojas: ${matchDescriptions.join(" ")}`,
    `Total de discrepancias: ${discrepancies.length} (${critCount} críticas, ${majCount} mayores, ${minCount} menores).`,
    discrepancies.length === 0 ? "✅ Los archivos son idénticos en contenido." : "",
  ].filter(Boolean).join("\n");

  return { summary, totalDiscrepancies: discrepancies.length, baseFile: file1Label, discrepancies };
}

function compareWordDeterministic(
  text1: string,
  text2: string,
  file1Label: string,
  file2Label: string
): { summary: string; totalDiscrepancies: number; baseFile: string; discrepancies: DetDiscrepancy[] } {
  // Split into sentences/segments for granular comparison
  const split = (t: string) => t.split(/(?<=[.;!?\n])\s+/).map(s => s.trim()).filter(s => s.length > 0);
  const segs1 = split(text1);
  const segs2 = split(text2);
  const discrepancies: DetDiscrepancy[] = [];
  let discId = 1;
  const maxLen = Math.max(segs1.length, segs2.length);

  for (let i = 0; i < maxLen; i++) {
    const s1 = segs1[i] || "";
    const s2 = segs2[i] || "";
    if (s1.trim().toLowerCase() !== s2.trim().toLowerCase()) {
      if (s1 && !s2) {
        discrepancies.push({
          id: discId++, type: "missing_data", severity: "major",
          sourceFile: file1Label, sourceLocation: `Segmento #${i + 1}`,
          sourceValue: s1.slice(0, 500), targetFile: file2Label,
          targetLocation: `Segmento #${i + 1}`, targetValue: "(vacío)",
          expectedValue: s1.slice(0, 500),
          explanation: `El segmento #${i + 1} existe en ${file1Label} pero no en ${file2Label}.`,
        });
      } else if (!s1 && s2) {
        discrepancies.push({
          id: discId++, type: "extra_data", severity: "major",
          sourceFile: file1Label, sourceLocation: `Segmento #${i + 1}`,
          sourceValue: "(vacío)", targetFile: file2Label,
          targetLocation: `Segmento #${i + 1}`, targetValue: s2.slice(0, 500),
          expectedValue: "(vacío)",
          explanation: `El segmento #${i + 1} existe en ${file2Label} pero no en ${file1Label}.`,
        });
      } else {
        discrepancies.push({
          id: discId++, type: "value_mismatch", severity: "major",
          sourceFile: file1Label, sourceLocation: `Segmento #${i + 1}`,
          sourceValue: s1.slice(0, 500), targetFile: file2Label,
          targetLocation: `Segmento #${i + 1}`, targetValue: s2.slice(0, 500),
          expectedValue: s1.slice(0, 500),
          explanation: `El contenido del segmento #${i + 1} difiere entre ambos archivos.`,
        });
      }
    }
  }

  const summary = [
    `Comparación determinística de texto completada.`,
    `${file1Label}: ${segs1.length} segmentos. ${file2Label}: ${segs2.length} segmentos.`,
    `Total de discrepancias: ${discrepancies.length}.`,
    discrepancies.length === 0 ? "✅ Los documentos son idénticos en contenido." : "",
  ].filter(Boolean).join("\n");

  return { summary, totalDiscrepancies: discrepancies.length, baseFile: file1Label, discrepancies };
}

function compareExcelWordDeterministic(
  excelData: { sheets: SheetData[] },
  wordText: string,
  file1Label: string,
  file2Label: string
): { summary: string; totalDiscrepancies: number; baseFile: string; discrepancies: DetDiscrepancy[] } {
  // Extract all values from Excel and check if they appear in Word text
  const discrepancies: DetDiscrepancy[] = [];
  let discId = 1;
  const wordLower = wordText.toLowerCase();
  let checkedCount = 0;
  let missingCount = 0;

  for (const sheet of excelData.sheets) {
    for (const [addr, val] of Object.entries(sheet.rawCells)) {
      const trimVal = val.trim();
      if (!trimVal) continue;
      checkedCount++;
      
      // For numbers, check if the number appears in the word doc
      const numVal = Number(trimVal.replace(/,/g, ""));
      let found = false;
      
      if (!isNaN(numVal) && trimVal !== "") {
        // Check various number formats
        found = wordText.includes(trimVal) || 
                wordText.includes(String(numVal)) ||
                wordText.includes(numVal.toLocaleString("en-US")) ||
                wordText.includes(numVal.toLocaleString("es-ES"));
      } else {
        found = wordLower.includes(trimVal.toLowerCase());
      }

      if (!found) {
        missingCount++;
        discrepancies.push({
          id: discId++,
          type: "missing_data",
          severity: !isNaN(numVal) && trimVal !== "" ? "critical" : "major",
          sourceFile: file1Label,
          sourceLocation: `Hoja '${sheet.name}', Celda ${addr}`,
          sourceValue: trimVal,
          targetFile: file2Label,
          targetLocation: "Documento completo",
          targetValue: "(no encontrado)",
          expectedValue: trimVal,
          explanation: `El valor "${trimVal}" de la celda ${addr} (hoja "${sheet.name}") no se encontró en el documento Word.`,
        });
      }
    }
  }

  const summary = [
    `Comparación determinística Excel vs Word completada.`,
    `Se verificaron ${checkedCount} valores del Excel contra el contenido del Word.`,
    `${missingCount} valores no encontrados en el documento Word.`,
    discrepancies.length === 0 ? "✅ Todos los valores del Excel aparecen en el documento Word." : "",
  ].filter(Boolean).join("\n");

  return { summary, totalDiscrepancies: discrepancies.length, baseFile: file1Label, discrepancies };
}

// ==================== MAIN SERVER ====================

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Autenticación requerida." }),
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
        JSON.stringify({ error: "Sesión inválida." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formData = await req.formData();
    const mode = formData.get("mode") as string;
    const primaryLang = (formData.get("primaryLang") as string) || "es";
    const docType = formData.get("docType") as string;
    const langPair = (formData.get("langPair") as string) || "es-en";

    const file1 = formData.get("file1") as File | null;
    const file2 = formData.get("file2") as File | null;
    const file3 = formData.get("file3") as File | null;
    const file4 = formData.get("file4") as File | null;

    if (mode === "translation") {
      // ===== TRANSLATION MODE: Still uses AI =====
      if (!file1 || !file2 || !file3 || !file4) {
        return new Response(
          JSON.stringify({ error: "Se requieren los 4 archivos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const file of [file1, file2, file3, file4]) {
        if (file.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: "Archivo demasiado grande. Máximo 10MB." }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

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

      const systemPrompt = `You are a bilingual (Spanish/English) financial document comparison expert.
The PRIMARY file is: ${primaryFile}. The translation target language is ${targetLang}.
Compare the documents for TRANSLATION accuracy. The primary file is the source of truth.
All discrepancies should show what the ${targetLang} translation SHOULD be based on the primary file.

IMPORTANT: ALL output text (summary, explanations, descriptions) MUST be in SPANISH ONLY.

IMPORTANT - SHEET/TAB MATCHING FOR EXCEL FILES (use this 3-level strategy in order):
1. MATCH BY NAME: Try to match sheets by their name or translated name (e.g. "Balance General" ↔ "Balance Sheet").
2. MATCH BY ORDER: If names don't match, match by position (Sheet #1 vs Sheet #1, Sheet #2 vs Sheet #2, etc.).
3. MATCH BY CONTENT: If neither name nor order produces a reasonable match, analyze the DATA STRUCTURE and VALUES inside each sheet.
- In your summary, explain HOW each sheet pair was matched.
- If a sheet exists in one file but has NO counterpart, report it as a "missing_sheet" discrepancy with severity "major".
- Always include the SHEET NAME in every sourceLocation and targetLocation.

For EVERY discrepancy found, provide:
1. The original text in the primary file and its location
2. The translated text found in ${targetFile} and its location
3. What the correct ${targetLang} translation should be
4. Severity: "critical" (numbers/amounts wrong), "major" (meaning changed), "minor" (style/preference)

Return your analysis as a JSON object:
{
  "summary": "Evaluación general breve en español.",
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
      "explanation": "Explicación breve en español"
    }
  ]
}`;

      const userContent = `## Excel File 1 (ES) - "${file1.name}"
${excel1Summary}

## Excel File 2 (EN) - "${file2.name}"
${excel2Summary}

## Word File 1 (ES) - "${file3.name}"
${word1Text}

## Word File 2 (EN) - "${file4.name}"
${word2Text}`;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.1,
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intente más tarde." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos agotados." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        return new Response(
          JSON.stringify({ error: "Error al procesar documentos." }),
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

    } else if (mode === "data") {
      // ===== DATA MODE: Deterministic comparison, NO AI =====
      if (!file1 || !file2) {
        return new Response(
          JSON.stringify({ error: "Se requieren 2 archivos." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const file of [file1, file2]) {
        if (file.size > MAX_FILE_SIZE) {
          return new Response(
            JSON.stringify({ error: "Archivo demasiado grande. Máximo 10MB." }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const langLabels: Record<string, { l1: string; l2: string }> = {
        "es-en": { l1: "ES", l2: "EN" },
        "es-es": { l1: "ES", l2: "ES" },
        "en-en": { l1: "EN", l2: "EN" },
        "en-es": { l1: "EN", l2: "ES" },
      };
      const labels = langLabels[langPair] || { l1: "File 1", l2: "File 2" };
      const file1Label = `File 1 (${labels.l1})`;
      const file2Label = `File 2 (${labels.l2})`;

      let result;

      if (docType === "excel") {
        const [data1, data2] = await Promise.all([
          file1.arrayBuffer().then(parseExcel),
          file2.arrayBuffer().then(parseExcel),
        ]);
        result = compareExcelDeterministic(data1, data2, file1Label, file2Label);
      } else if (docType === "excel-word") {
        const [excelData, wordText] = await Promise.all([
          file1.arrayBuffer().then(parseExcel),
          file2.arrayBuffer().then(parseDocx),
        ]);
        result = compareExcelWordDeterministic(excelData, wordText, file1Label, file2Label);
      } else {
        // Word vs Word
        const [text1, text2] = await Promise.all([
          file1.arrayBuffer().then(parseDocx),
          file2.arrayBuffer().then(parseDocx),
        ]);
        result = compareWordDeterministic(text1, text2, file1Label, file2Label);
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(
        JSON.stringify({ error: "Modo de comparación inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e) {
    console.error("compare-documents error:", e);
    return new Response(
      JSON.stringify({ error: "Error al comparar documentos." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
