import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FileDiff, Shield } from "lucide-react";
import GlossaryTab from "@/components/GlossaryTab";
import ComparisonTab from "@/components/ComparisonTab";
import LoginDialog from "@/components/LoginDialog";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header with gradient */}
      <header
        className="relative overflow-hidden border-b border-border/30"
        style={{ background: "var(--gradient-header)" }}
      >
        {/* Subtle decorative shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5 blur-2xl" />
        </div>

        <div className="relative container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 shadow-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Plataforma de Análisis Financiero
              </h1>
              <p className="text-sm text-white/60 font-light">
                Financial Document Analysis Platform
              </p>
            </div>
          </div>
          <LoginDialog />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="glossary" className="w-full">
          <TabsList className="w-full justify-start mb-8 bg-muted/50 p-1 rounded-xl border border-border/50">
            <TabsTrigger
              value="glossary"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2.5 transition-all"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Glosario / Glossary</span>
              <span className="sm:hidden font-medium">Glosario</span>
            </TabsTrigger>
            <TabsTrigger
              value="comparison"
              className="gap-2 rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2.5 transition-all"
            >
              <FileDiff className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Comparación / Comparison</span>
              <span className="sm:hidden font-medium">Comparar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="glossary">
            <GlossaryTab />
          </TabsContent>
          <TabsContent value="comparison">
            <ComparisonTab />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Plataforma de Análisis Financiero
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
