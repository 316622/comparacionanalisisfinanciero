import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, Database, History } from "lucide-react";

const categories = [
  { value: "balance-sheet", label: "Balance General / Balance Sheet" },
  { value: "income-statement", label: "Estado de Resultados / Income Statement" },
  { value: "cash-flow", label: "Flujo de Efectivo / Cash Flow" },
];

const years = ["2024", "2023", "2022", "2021", "2020"];

type ViewMode = "data" | "history";

interface Slide {
  id: string;
  category: string;
  year: string;
  slide_order: number;
  title: string;
  content: string | null;
  chart_data: any;
}

const PresentationTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("data");
  const [category, setCategory] = useState("balance-sheet");
  const [year, setYear] = useState("2024");
  const [selectedYears, setSelectedYears] = useState<string[]>(["2024", "2023"]);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleYear = (y: string) => {
    setSelectedYears((prev) =>
      prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y]
    );
  };

  const fetchSlides = async () => {
    setLoading(true);
    if (viewMode === "data") {
      const { data, error } = await supabase
        .from("presentation_slides")
        .select("*")
        .eq("category", category)
        .eq("year", year)
        .order("slide_order");
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setSlides((data as any[]) || []);
      }
    } else {
      if (selectedYears.length === 0) {
        setSlides([]);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("presentation_slides")
        .select("*")
        .eq("category", category)
        .in("year", selectedYears)
        .order("year", { ascending: true })
        .order("slide_order");
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        setSlides((data as any[]) || []);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    setSlideIndex(0);
    fetchSlides();
  }, [category, year, viewMode, selectedYears]);

  const currentSlide = slides[slideIndex];

  const goTo = (dir: -1 | 1) => {
    setSlideIndex((prev) => Math.max(0, Math.min(slides.length - 1, prev + dir)));
  };

  const openNew = () => {
    setEditing(null);
    setFormTitle("");
    setFormContent("");
    setDialogOpen(true);
  };

  const openEdit = () => {
    if (!currentSlide) return;
    setEditing(currentSlide);
    setFormTitle(currentSlide.title);
    setFormContent(currentSlide.content || "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("presentation_slides")
        .update({ title: formTitle, content: formContent } as any)
        .eq("id", editing.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const targetYear = viewMode === "data" ? year : selectedYears[0] || "2024";
      const { error } = await supabase
        .from("presentation_slides")
        .insert({ category, year: targetYear, title: formTitle, content: formContent, slide_order: slides.length } as any);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setSaving(false);
    setDialogOpen(false);
    fetchSlides();
  };

  const handleDelete = async () => {
    if (!currentSlide) return;
    const { error } = await supabase.from("presentation_slides").delete().eq("id", currentSlide.id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    setSlideIndex(Math.max(0, slideIndex - 1));
    fetchSlides();
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        <Button
          variant={viewMode === "data" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("data")}
        >
          <Database className="h-4 w-4 mr-1" /> Datos / Data
        </Button>
        <Button
          variant={viewMode === "history" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("history")}
        >
          <History className="h-4 w-4 mr-1" /> Historial / History
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={category} onValueChange={(v) => setCategory(v)}>
          <SelectTrigger className="sm:w-[280px]">
            <SelectValue placeholder="Categoría / Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {viewMode === "data" ? (
          <Select value={year} onValueChange={(v) => setYear(v)}>
            <SelectTrigger className="sm:w-[140px]">
              <SelectValue placeholder="Año / Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-3 flex-wrap border rounded-md px-3 py-2">
            <span className="text-sm text-muted-foreground font-medium">Años:</span>
            {years.map((y) => (
              <label key={y} className="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedYears.includes(y)}
                  onCheckedChange={() => toggleYear(y)}
                />
                <span className="text-sm">{y}</span>
              </label>
            ))}
          </div>
        )}

        {user && (
          <div className="flex gap-2 ml-auto">
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" /> Agregar Slide
            </Button>
            {currentSlide && (
              <>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Slide view */}
      <Card className="min-h-[400px] flex flex-col">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">
            {loading
              ? "Cargando..."
              : currentSlide
                ? `${currentSlide.title} — ${currentSlide.year}`
                : "Sin datos / No data"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-8">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : currentSlide ? (
            <p className="text-muted-foreground text-center max-w-lg whitespace-pre-wrap">{currentSlide.content}</p>
          ) : (
            <p className="text-muted-foreground text-center">
              {viewMode === "history" && selectedYears.length === 0
                ? "Selecciona al menos un año. / Select at least one year."
                : user
                  ? "No hay slides. Haz clic en 'Agregar Slide' para crear uno."
                  : "No hay datos disponibles. / No data available."}
            </p>
          )}
        </CardContent>
      </Card>

      {slides.length > 0 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={slideIndex === 0} onClick={() => goTo(-1)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            {slideIndex + 1} / {slides.length}
          </span>
          <Button variant="outline" size="sm" disabled={slideIndex === slides.length - 1} onClick={() => goTo(1)}>
            Siguiente <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-foreground/30 bg-card text-card-foreground">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Slide / Edit Slide" : "Nuevo Slide / New Slide"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Título / Title</Label>
              <Input required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="border-foreground/30 text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Contenido / Content</Label>
              <Textarea rows={6} value={formContent} onChange={(e) => setFormContent(e.target.value)} className="border-foreground/30 text-foreground" />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar / Save" : "Agregar / Add"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PresentationTab;
