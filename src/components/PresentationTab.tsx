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
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Loader2, Database, History, BarChart3, Download } from "lucide-react";
import { z } from "zod";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const slideSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(300, "Máximo 300 caracteres"),
  content: z.string().trim().max(10000, "Máximo 10000 caracteres").optional().nullable(),
});

const categories = [
  { value: "balance-sheet", label: "Balance General / Balance Sheet" },
  { value: "income-statement", label: "Estado de Resultados / Income Statement" },
  { value: "cash-flow", label: "Flujo de Efectivo / Cash Flow" },
];

const years = ["2024", "2023", "2022", "2021", "2020"];

const CHART_COLORS = [
  "hsl(214, 100%, 33%)",  // primary
  "hsl(193, 33%, 62%)",   // secondary
  "hsl(43, 95%, 54%)",    // accent
  "hsl(18, 89%, 61%)",    // destructive
  "hsl(160, 50%, 45%)",
  "hsl(280, 50%, 55%)",
];

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

const SlideChart = ({ chartData }: { chartData: any }) => {
  if (!chartData) return null;

  const { type, data, xKey, yKeys, nameKey, valueKey } = chartData;

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  if (type === "bar") {
    const keys = yKeys || Object.keys(data[0]).filter((k) => k !== (xKey || "name"));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 80%)" />
          <XAxis dataKey={xKey || "name"} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {keys.map((key: string, i: number) => (
            <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    const keys = yKeys || Object.keys(data[0]).filter((k) => k !== (xKey || "name"));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 80%)" />
          <XAxis dataKey={xKey || "name"} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          {keys.map((key: string, i: number) => (
            <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey || "value"}
            nameKey={nameKey || "name"}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_: any, i: number) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-xs text-muted-foreground">Tipo de gráfico no soportado: {type}</p>;
};

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
  const [formChartData, setFormChartData] = useState("");
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
    setFormChartData("");
    setDialogOpen(true);
  };

  const openEdit = () => {
    if (!currentSlide) return;
    setEditing(currentSlide);
    setFormTitle(currentSlide.title);
    setFormContent(currentSlide.content || "");
    setFormChartData(currentSlide.chart_data ? JSON.stringify(currentSlide.chart_data, null, 2) : "");
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const parseResult = slideSchema.safeParse({
      title: formTitle,
      content: formContent || null,
    });

    if (!parseResult.success) {
      toast({ title: "Error de validación", description: parseResult.error.errors[0].message, variant: "destructive" });
      return;
    }

    let chartDataParsed = null;
    if (formChartData.trim()) {
      try {
        chartDataParsed = JSON.parse(formChartData);
      } catch {
        toast({ title: "Error", description: "JSON de datos de gráfico inválido.", variant: "destructive" });
        return;
      }
    }

    const validated = { ...parseResult.data, chart_data: chartDataParsed };
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from("presentation_slides")
        .update(validated as any)
        .eq("id", editing.id);
      if (error) toast({ title: "Error", description: "No se pudo guardar. / Could not save.", variant: "destructive" });
    } else {
      const targetYear = viewMode === "data" ? year : selectedYears[0] || "2024";
      const { error } = await supabase
        .from("presentation_slides")
        .insert({ ...validated, category, year: targetYear, slide_order: slides.length } as any);
      if (error) toast({ title: "Error", description: "No se pudo guardar. / Could not save.", variant: "destructive" });
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
        <Button variant={viewMode === "data" ? "default" : "outline"} size="sm" onClick={() => setViewMode("data")}>
          <Database className="h-4 w-4 mr-1" /> Datos / Data
        </Button>
        <Button variant={viewMode === "history" ? "default" : "outline"} size="sm" onClick={() => setViewMode("history")}>
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
                <Checkbox checked={selectedYears.includes(y)} onCheckedChange={() => toggleYear(y)} />
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {loading
                ? "Cargando..."
                : currentSlide
                  ? `${currentSlide.title} — ${currentSlide.year}`
                  : "Sin datos / No data"}
            </CardTitle>
            {currentSlide?.chart_data && (
              <BarChart3 className="h-5 w-5 text-primary" />
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : currentSlide ? (
            <>
              {currentSlide.content && (
                <p className="text-muted-foreground text-center max-w-lg whitespace-pre-wrap">{currentSlide.content}</p>
              )}
              {currentSlide.chart_data && (
                <div className="w-full max-w-2xl">
                  <SlideChart chartData={currentSlide.chart_data} />
                </div>
              )}
              {!currentSlide.content && !currentSlide.chart_data && (
                <p className="text-muted-foreground text-center">Sin contenido / No content</p>
              )}
            </>
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
        <DialogContent className="border-foreground/30 bg-card text-card-foreground sm:max-w-lg">
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
              <Textarea rows={4} value={formContent} onChange={(e) => setFormContent(e.target.value)} className="border-foreground/30 text-foreground" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Datos de Gráfico / Chart Data (JSON)</Label>
              <Textarea
                rows={4}
                value={formChartData}
                onChange={(e) => setFormChartData(e.target.value)}
                placeholder='{"type":"bar","data":[{"name":"Q1","value":100}]}'
                className="border-foreground/30 text-foreground font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Tipos: bar, line, pie. Ejemplo: {`{"type":"bar","data":[{"name":"2023","ingresos":500,"gastos":300}]}`}
              </p>
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
