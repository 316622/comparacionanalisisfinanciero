import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "npm:xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Extract text content from a DOCX file (basic XML parsing)
async function parseDocx(buffer: ArrayBuffer): Promise<string> {
  // DOCX is a ZIP containing XML files. We'll use a simple approach.
  const uint8 = new Uint8Array(buffer);
  
  // Use JSZip-like approach with Deno's built-in ZIP support
  // For simplicity, we'll extract raw text from the XML
  const decoder = new TextDecoder();
  const raw = decoder.decode(uint8);
  
  // Try to find word/document.xml content in the zip
  // Simple approach: look for text between <w:t> tags
  const textParts: string[] = [];
  const regex = /<w:t[^>]*>(.*?)<\/w:t>/gs;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    textParts.push(match[1]);
  }
  
  if (textParts.length > 0) {
    return textParts.join(" ");
  }
  
  // Fallback: strip all XML tags
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 50000);
}

// Extract structured data from Excel
function parseExcel(buffer: ArrayBuffer): { sheets: { name: string; data: Record<string, string>[] ; rawCells: Record<string, string> }[] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheets = workbook.SheetNames.map((name: string) => {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, string>[];
    
    // Also get raw cell references
    const rawCells: Record<string, string> = {};
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (cell && cell.v !== undefined && cell.v !== "") {
          rawCells[addr] = String(cell.v);
        }
      }
    }
    
    return { name, data, rawCells };
  });
  return { sheets };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const mode = formData.get("mode") as string; // "translation" or "data"
    const baseFile = formData.get("baseFile") as string; // "file1" or "file2"
    
    const excel1 = formData.get("excel1") as File | null;
    const excel2 = formData.get("excel2") as File | null;
    const word1 = formData.get("word1") as File | null;
    const word2 = formData.get("word2") as File | null;

    if (!excel1 || !excel2 || !word1 || !word2) {
      return new Response(
        JSON.stringify({ error: "Se requieren los 4 archivos / All 4 files are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse files
    const [excel1Data, excel2Data, word1Text, word2Text] = await Promise.all([
      excel1.arrayBuffer().then(parseExcel),
      excel2.arrayBuffer().then(parseExcel),
      word1.arrayBuffer().then(parseDocx),
      word2.arrayBuffer().then(parseDocx),
    ]);

    // Build context for AI
    const excel1Summary = excel1Data.sheets.map(s => {
      const cellEntries = Object.entries(s.rawCells).slice(0, 200);
      return `Sheet "${s.name}":\n${cellEntries.map(([cell, val]) => `  ${cell}: ${val}`).join("\n")}`;
    }).join("\n\n");

    const excel2Summary = excel2Data.sheets.map(s => {
      const cellEntries = Object.entries(s.rawCells).slice(0, 200);
      return `Sheet "${s.name}":\n${cellEntries.map(([cell, val]) => `  ${cell}: ${val}`).join("\n")}`;
    }).join("\n\n");

    const systemPrompt = mode === "translation"
      ? `You are a bilingual (Spanish/English) financial document comparison expert. 
Compare the following documents for TRANSLATION accuracy. 
Identify any mistranslations, missing translations, or inaccurate translations.

For EVERY discrepancy found, you MUST provide:
1. The original text and its location (file name, sheet name if Excel, cell reference if Excel, or page/section if Word)
2. The translated text and its location
3. What the correct translation should be
4. Severity: "critical" (numbers/amounts wrong), "major" (meaning changed), "minor" (style/preference)

Return your analysis as a JSON array with this structure:
{
  "summary": "Brief overall assessment in Spanish and English",
  "totalDiscrepancies": number,
  "discrepancies": [
    {
      "id": number,
      "type": "mistranslation" | "missing" | "inconsistent" | "number_mismatch",
      "severity": "critical" | "major" | "minor",
      "sourceFile": "Excel 1 (ES)" | "Excel 2 (EN)" | "Word 1 (ES)" | "Word 2 (EN)",
      "sourceLocation": "Sheet X, Cell Y" or "Section/paragraph description",
      "sourceText": "original text",
      "targetFile": "the other file",
      "targetLocation": "Sheet X, Cell Y" or "Section/paragraph description", 
      "targetText": "translated text found",
      "correctTranslation": "what it should say",
      "explanation": "Brief explanation in Spanish and English"
    }
  ]
}`
      : `You are a bilingual (Spanish/English) financial data comparison expert.
The BASE file is: ${baseFile === "file1" ? "File 1 (ES)" : "File 2 (EN)"}. 
Extract all data from the base file, translate it, and compare against the other file.

For EVERY data discrepancy found, you MUST provide:
1. The data value in the base file and its exact location (file name, sheet name, cell reference)
2. The corresponding data in the comparison file and its exact location
3. What the expected value should be
4. Severity: "critical" (financial amounts differ), "major" (key data differs), "minor" (formatting/rounding)

Return your analysis as a JSON array with this structure:
{
  "summary": "Brief overall assessment in Spanish and English",
  "baseFile": "${baseFile === "file1" ? "File 1 (ES)" : "File 2 (EN)"}",
  "totalDiscrepancies": number,
  "discrepancies": [
    {
      "id": number,
      "type": "value_mismatch" | "missing_data" | "extra_data" | "format_difference",
      "severity": "critical" | "major" | "minor",
      "sourceFile": "file name",
      "sourceLocation": "Sheet X, Cell Y" or "Section/paragraph",
      "sourceValue": "value in base file",
      "targetFile": "comparison file name",
      "targetLocation": "Sheet X, Cell Y" or "Section/paragraph",
      "targetValue": "value in comparison file",
      "expectedValue": "what the correct value should be",
      "explanation": "Brief explanation in Spanish and English"
    }
  ]
}`;

    const userContent = `## Excel File 1 (ES) - "${excel1.name}"
${excel1Summary}

## Excel File 2 (EN) - "${excel2.name}"
${excel2Summary}

## Word File 1 (ES) - "${word1.name}"
${word1Text.slice(0, 15000)}

## Word File 2 (EN) - "${word2.name}"
${word2Text.slice(0, 15000)}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let parsed;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      // If can't parse, return raw text
      parsed = { summary: content, totalDiscrepancies: 0, discrepancies: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("compare-documents error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
