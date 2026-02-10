import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, FileDiff } from "lucide-react";
import GlossaryTab from "@/components/GlossaryTab";
import ComparisonTab from "@/components/ComparisonTab";
import LoginDialog from "@/components/LoginDialog";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Plataforma de Análisis Financiero
            </h1>
            <p className="text-sm text-primary-foreground/70">
              Financial Document Analysis Platform
            </p>
          </div>
          <LoginDialog />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="glossary" className="w-full">
          <TabsList className="w-full justify-start mb-6">
            <TabsTrigger value="glossary" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Glosario / Glossary</span>
              <span className="sm:hidden">Glosario</span>
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2">
              <FileDiff className="h-4 w-4" />
              <span className="hidden sm:inline">Comparación / Comparison</span>
              <span className="sm:hidden">Comparar</span>
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
    </div>
  );
};

export default Index;
