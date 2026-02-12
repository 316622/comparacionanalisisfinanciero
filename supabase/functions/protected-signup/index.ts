import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://id-preview--bbac1346-2bfd-4c26-96a8-b78c3bf64d65.lovable.app",
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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, accessCode } = await req.json();

    if (!email || !password || !accessCode) {
      return new Response(
        JSON.stringify({ error: "Todos los campos son requeridos. / All fields are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ACCESS_CODE = Deno.env.get("ACCESS_CODE");
    if (!ACCESS_CODE || accessCode !== ACCESS_CODE) {
      return new Response(
        JSON.stringify({ error: "Código de acceso inválido. / Invalid access code." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-assign role: first user gets admin, others get viewer
    if (data?.user) {
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true });

      const role = (count === null || count === 0) ? "admin" : "viewer";

      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role });

      if (roleError) {
        console.error("Failed to assign role:", roleError);
      }
    }

    return new Response(
      JSON.stringify({ message: "Cuenta creada. Revisa tu correo para confirmar. / Account created. Check your email to confirm." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("protected-signup error:", e);
    return new Response(
      JSON.stringify({ error: "Error al crear la cuenta. / Error creating account." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
