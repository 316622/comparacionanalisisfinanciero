import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const categories = [
  { value: "balance-sheet", label: "Balance General / Balance Sheet" },
  { value: "income-statement", label: "Estado de Resultados / Income Statement" },
  { value: "cash-flow", label: "Flujo de Efectivo / Cash Flow" },
];

const years = ["2024", "2023", "2022", "2021", "2020"];

// Placeholder slides — will be replaced with real DB data
const placeholderSlides: Record<string, { title: string; content: string }[]> = {
  "balance-sheet": [
    { title: "Balance General - Resumen", content: "Seleccione una categoría y año para ver los datos financieros. Los datos serán cargados desde la base de datos." },
    { title: "Activos Totales", content: "Los datos de activos se mostrarán aquí con gráficos y tablas detalladas." },
    { title: "Pasivos y Patrimonio", content: "Desglose de pasivos corrientes, no corrientes y patrimonio neto." },
  ],
  "income-statement": [
    { title: "Estado de Resultados - Resumen", content: "Vista general de ingresos, costos y utilidades del período seleccionado." },
    { title: "Ingresos Operacionales", content: "Detalle de ingresos por línea de negocio y comparación interanual." },
    { title: "Gastos y Utilidad Neta", content: "Análisis de gastos operativos y cálculo de utilidad neta." },
  ],
  "cash-flow": [
    { title: "Flujo de Efectivo - Resumen", content: "Movimientos de efectivo operativo, de inversión y financiamiento." },
    { title: "Actividades Operativas", content: "Efectivo generado por las operaciones del negocio." },
    { title: "Actividades de Inversión y Financiamiento", content: "Inversiones en activos y movimientos de deuda y capital." },
  ],
};

const PresentationTab = () => {
  const [category, setCategory] = useState("balance-sheet");
  const [year, setYear] = useState("2024");
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = placeholderSlides[category] || [];
  const currentSlide = slides[slideIndex];

  const goTo = (dir: -1 | 1) => {
    setSlideIndex((prev) => Math.max(0, Math.min(slides.length - 1, prev + dir)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={category} onValueChange={(v) => { setCategory(v); setSlideIndex(0); }}>
          <SelectTrigger className="sm:w-[280px]">
            <SelectValue placeholder="Categoría / Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={year} onValueChange={(v) => { setYear(v); setSlideIndex(0); }}>
          <SelectTrigger className="sm:w-[140px]">
            <SelectValue placeholder="Año / Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Slide viewer */}
      <Card className="min-h-[400px] flex flex-col">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg">
            {currentSlide?.title} — {year}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-8">
          <p className="text-muted-foreground text-center max-w-lg">
            {currentSlide?.content}
          </p>
        </CardContent>
      </Card>

      {/* Navigation */}
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
    </div>
  );
};

export default PresentationTab;
