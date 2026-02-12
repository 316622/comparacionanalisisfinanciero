import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 2 || query.length > 500) {
      return new Response(JSON.stringify({ error: "Query inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all glossary terms
    const { data: terms, error } = await supabase
      .from("glossary_terms")
      .select("id, term_es, term_en, definition, category, category_id")
      .order("term_es");

    if (error) throw error;
    if (!terms || terms.length === 0) {
      return new Response(JSON.stringify({ results: [], explanation: "No hay términos en el glosario." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context for AI
    const termsList = terms.map((t: any) => `- ${t.term_es} / ${t.term_en}: ${t.definition || "sin definición"}`).join("\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
            content: `You are a bilingual (Spanish/English) financial glossary search assistant. Given a user query (which can be a concept, question, or description), find the most relevant terms from the glossary below. Return a JSON object with:
- "results": array of term IDs (strings) that match the concept, sorted by relevance (max 10)
- "explanation": a brief bilingual explanation of why these terms are relevant

GLOSSARY:
${termsList}

Return ONLY valid JSON, no markdown.`
          },
          { role: "user", content: query }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    // Parse AI response
    let parsed: { results?: string[]; explanation?: string };
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { results: [], explanation: "No se pudo procesar la respuesta." };
    }

    const matchedIds = parsed.results || [];
    const matchedTerms = matchedIds
      .map((id: string) => terms.find((t: any) => t.id === id))
      .filter(Boolean);

    return new Response(JSON.stringify({
      results: matchedTerms,
      explanation: parsed.explanation || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Semantic search error:", err);
    return new Response(JSON.stringify({ error: "Error en la búsqueda semántica." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
