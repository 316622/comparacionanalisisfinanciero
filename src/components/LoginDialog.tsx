import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const LoginDialog = () => {
  const { user, signIn, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-primary-foreground/70 hidden sm:inline">{user.email}</span>
        <Button variant="outline" size="sm" className="border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1" /> Salir
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isSignUp) {
      // Server-side access code validation for sign up
      try {
        const { data, error: fnError } = await supabase.functions.invoke("protected-signup", {
          body: { email, password, accessCode },
        });

        if (fnError) {
          toast({ title: "Error", description: fnError.message, variant: "destructive" });
        } else if (data?.error) {
          toast({ title: "Error", description: data.error, variant: "destructive" });
        } else {
          toast({ title: "Cuenta creada", description: "Revisa tu correo para confirmar. / Check your email to confirm." });
          setOpen(false);
        }
      } catch {
        toast({ title: "Error", description: "Error de conexión. / Connection error.", variant: "destructive" });
      }
    } else {
      // Sign in doesn't need access code
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setOpen(false);
      }
    }

    setSubmitting(false);
    setEmail("");
    setPassword("");
    setAccessCode("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
          <LogIn className="h-4 w-4 mr-1" /> Iniciar Sesión
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-foreground/30 bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>{isSignUp ? "Crear Cuenta / Sign Up" : "Iniciar Sesión / Sign In"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-foreground">Correo / Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="border-foreground/30 text-foreground" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Contraseña / Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="border-foreground/30 text-foreground" />
          </div>
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="accessCode" className="text-foreground">Código de Acceso / Access Code</Label>
              <Input id="accessCode" type="password" required value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Ingresa el código de acceso" className="border-foreground/30 text-foreground" />
            </div>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSignUp ? "Crear Cuenta / Sign Up" : "Iniciar Sesión / Sign In"}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {isSignUp ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
            <button type="button" className="text-primary underline" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? "Iniciar Sesión / Sign In" : "Crear Cuenta / Sign Up"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoginDialog;
