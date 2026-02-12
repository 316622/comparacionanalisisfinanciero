import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { comparisonSummary, discrepancies } = await req.json();

    if (!comparisonSummary || !discrepancies) {
      return new Response(JSON.stringify({ error: "Missing data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Build context from discrepancies
    const discrepancyText = discrepancies.slice(0, 20).map((d: any) =>
      `- Type: ${d.type}, Source: "${d.sourceText || d.sourceValue || ""}", Target: "${d.targetText || d.targetValue || ""}", Explanation: ${d.explanation}`
    ).join("\n");

    const aiResponse = await fetch("https://ai.lovable.dev/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `You are a bilingual financial terminology extractor. Given comparison results from financial documents, extract unique financial/accounting terms that should be added to a glossary. Return a JSON array of objects with:
- "term_es": Spanish term
- "term_en": English term  
- "definition": Brief bilingual definition

Extract ONLY financial/accounting/audit terms. Max 15 terms. Return ONLY valid JSON array, no markdown.`
          },
          {
            role: "user",
            content: `Comparison summary: ${comparisonSummary}\n\nDiscrepancies:\n${discrepancyText}`
          }
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let suggestions: Array<{ term_es: string; term_en: string; definition: string }>;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      suggestions = JSON.parse(cleaned);
      if (!Array.isArray(suggestions)) suggestions = [];
    } catch {
      suggestions = [];
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Extract terms error:", err);
    return new Response(JSON.stringify({ error: "Error al extraer términos." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
