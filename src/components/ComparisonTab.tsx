import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Loader2, Languages, Database, FileCheck, Download, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type ComparisonMode = "translation" | "data" | null;
type PrimaryLanguage = "es" | "en";
type LangPair = "es-en" | "es-es" | "en-en";

const langPairLabels: Record<LangPair, { file1: string; file2: string; label: string }> = {
  "es-en": { file1: "ES", file2: "EN", label: "Español vs English" },
  "es-es": { file1: "ES", file2: "ES", label: "Español vs Español" },
  "en-en": { file1: "EN", file2: "EN", label: "English vs English" },
};

interface FileSlot {
  label: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
}

interface Discrepancy {
  id: number;
  type: string;
  severity: "critical" | "major" | "minor";
  sourceFile: string;
  sourceLocation: string;
  sourceText?: string;
  sourceValue?: string;
  targetFile: string;
  targetLocation: string;
  targetText?: string;
  targetValue?: string;
  correctTranslation?: string;
  expectedValue?: string;
  explanation: string;
}

interface ComparisonResult {
  summary: string;
  totalDiscrepancies: number;
  baseFile?: string;
  discrepancies: Discrepancy[];
}

const severityColor: Record<string, string> = {
  critical: "destructive",
  major: "default",
  minor: "secondary",
};

const severityLabel: Record<string, string> = {
  critical: "Crítico",
  major: "Mayor",
  minor: "Menor",
};

const ComparisonTab = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<ComparisonMode>(null);
  const [primaryLang, setPrimaryLang] = useState<PrimaryLanguage>("es");
  const [excelLangPair, setExcelLangPair] = useState<LangPair>("es-en");
  const [wordLangPair, setWordLangPair] = useState<LangPair>("es-en");

  const getFileSlots = (): FileSlot[] => {
    const ep = langPairLabels[excelLangPair];
    const wp = langPairLabels[wordLangPair];
    return [
      { label: `Excel File 1 (${ep.file1})`, accept: ".xlsx,.xls,.csv", icon: <FileSpreadsheet className="h-6 w-6" />, file: files[0]?.file ?? null },
      { label: `Excel File 2 (${ep.file2})`, accept: ".xlsx,.xls,.csv", icon: <FileSpreadsheet className="h-6 w-6" />, file: files[1]?.file ?? null },
      { label: `Word File 1 (${wp.file1})`, accept: ".docx,.doc", icon: <FileText className="h-6 w-6" />, file: files[2]?.file ?? null },
      { label: `Word File 2 (${wp.file2})`, accept: ".docx,.doc", icon: <FileText className="h-6 w-6" />, file: files[3]?.file ?? null },
    ];
  };

  const [files, setFiles] = useState<FileSlot[]>([
    { label: "Excel File 1 (ES)", accept: ".xlsx,.xls,.csv", icon: <FileSpreadsheet className="h-6 w-6" />, file: null },
    { label: "Excel File 2 (EN)", accept: ".xlsx,.xls,.csv", icon: <FileSpreadsheet className="h-6 w-6" />, file: null },
    { label: "Word File 1 (ES)", accept: ".docx,.doc", icon: <FileText className="h-6 w-6" />, file: null },
    { label: "Word File 2 (EN)", accept: ".docx,.doc", icon: <FileText className="h-6 w-6" />, file: null },
  ]);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<ComparisonResult | null>(null);

  const handleFileChange = useCallback((index: number, file: File | null) => {
    setFiles((prev) => prev.map((slot, i) => (i === index ? { ...slot, file } : slot)));
    setResults(null);
  }, []);

  const allUploaded = files.every((f) => f.file !== null);

  const handleCompare = async () => {
    if (!mode) return;
    setIsComparing(true);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("mode", mode);
      formData.append("primaryLang", primaryLang);
      formData.append("excelLangPair", excelLangPair);
      formData.append("wordLangPair", wordLangPair);
      formData.append("excel1", files[0].file!);
      formData.append("excel2", files[1].file!);
      formData.append("word1", files[2].file!);
      formData.append("word2", files[3].file!);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data: ComparisonResult = await response.json();
      setResults(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsComparing(false);
    }
  };

  const downloadReport = () => {
    if (!results) return;
    const lines: string[] = [];
    lines.push("=== REPORTE DE COMPARACIÓN / COMPARISON REPORT ===\n");
    lines.push(results.summary + "\n");
    lines.push(`Total de discrepancias / Total discrepancies: ${results.totalDiscrepancies}\n`);
    if (results.baseFile) lines.push(`Archivo base / Base file: ${results.baseFile}\n`);
    lines.push("\n--- DISCREPANCIAS / DISCREPANCIES ---\n");

    results.discrepancies.forEach((d) => {
      lines.push(`#${d.id} [${d.severity.toUpperCase()}] ${d.type}`);
      lines.push(`  Origen / Source: ${d.sourceFile} → ${d.sourceLocation}`);
      lines.push(`  Valor / Value: ${d.sourceText || d.sourceValue || "N/A"}`);
      lines.push(`  Destino / Target: ${d.targetFile} → ${d.targetLocation}`);
      lines.push(`  Valor / Value: ${d.targetText || d.targetValue || "N/A"}`);
      if (d.correctTranslation) lines.push(`  Traducción correcta / Correct: ${d.correctTranslation}`);
      if (d.expectedValue) lines.push(`  Valor esperado / Expected: ${d.expectedValue}`);
      lines.push(`  Explicación / Explanation: ${d.explanation}`);
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparison-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Confidentiality notice */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <div>
          <p className="text-sm font-medium text-foreground">Confidencialidad / Confidentiality</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Los archivos subidos se procesan temporalmente en memoria y <strong>no se almacenan</strong> en ningún servidor ni base de datos. Son descartados inmediatamente después del análisis.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Uploaded files are processed temporarily in memory and are <strong>not stored</strong> on any server or database. They are discarded immediately after analysis.
          </p>
        </div>
      </div>

      {/* Step 1: Choose comparison mode */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Paso 1: Tipo de Comparación / Step 1: Comparison Type
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              mode === "translation" ? "ring-2 ring-primary border-primary" : "hover:border-primary/40"
            }`}
            onClick={() => { setMode("translation"); setResults(null); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Languages className="h-5 w-5 text-primary" />
                Comparación de Traducción
              </CardTitle>
              <CardDescription>Translation Comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Verifica si la traducción entre los documentos es correcta y precisa.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Checks if the translation between documents is correct and accurate.
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              mode === "data" ? "ring-2 ring-primary border-primary" : "hover:border-primary/40"
            }`}
            onClick={() => { setMode("data"); setResults(null); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Comparación de Datos
              </CardTitle>
              <CardDescription>Data Comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Extrae datos de un archivo base, los traduce y compara con el otro para encontrar discrepancias.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Extracts data from a base file, translates it, and compares with the other to find discrepancies.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Step 2: Primary language (for both modes) */}
      {mode && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Paso 2: Archivo Principal / Step 2: Primary File
          </h3>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">¿Cuál es el archivo principal? / Which is the primary file?</p>
                <p className="text-xs text-muted-foreground">
                  {mode === "translation"
                    ? "Las traducciones se verificarán hacia el otro idioma / Translations will be verified toward the other language"
                    : "Los datos se extraerán del archivo principal y se compararán con el otro / Data will be extracted from the primary file and compared with the other"}
                </p>
              </div>
              <Select value={primaryLang} onValueChange={(v) => setPrimaryLang(v as PrimaryLanguage)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="es">Español (ES) — Archivo 1</SelectItem>
                  <SelectItem value="en">English (EN) — Archivo 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </div>
      )}

      {/* Step 3: Language pairs */}
      {mode && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Paso 3: Idiomas de Archivos / Step 3: File Languages
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Excel</p>
                  <p className="text-xs text-muted-foreground">Combinación de idiomas / Language combination</p>
                </div>
                <Select value={excelLangPair} onValueChange={(v) => { setExcelLangPair(v as LangPair); setResults(null); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es-en">Español vs English</SelectItem>
                    <SelectItem value="es-es">Español vs Español</SelectItem>
                    <SelectItem value="en-en">English vs English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Word</p>
                  <p className="text-xs text-muted-foreground">Combinación de idiomas / Language combination</p>
                </div>
                <Select value={wordLangPair} onValueChange={(v) => { setWordLangPair(v as LangPair); setResults(null); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es-en">Español vs English</SelectItem>
                    <SelectItem value="es-es">Español vs Español</SelectItem>
                    <SelectItem value="en-en">English vs English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Upload files */}
      {mode && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Paso 4: Subir Archivos / Step 4: Upload Files
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {getFileSlots().map((slot, idx) => (
              <Card key={idx} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {slot.icon} {slot.label}
                    {(
                      (primaryLang === "es" && (idx === 0 || idx === 2)) ||
                      (primaryLang === "en" && (idx === 1 || idx === 3))
                    ) && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Base</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {files[idx]?.file ? (
                      <div className="text-center">
                        <p className="text-sm font-medium truncate max-w-[200px]">{files[idx].file!.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{(files[idx].file!.size / 1024).toFixed(1)} KB</p>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Click para subir / Click to upload</p>
                      </div>
                    )}
                    <input type="file" accept={slot.accept} className="hidden" onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)} />
                  </label>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Compare button */}
      {mode && (
        <div className="flex justify-center">
          <Button size="lg" disabled={!allUploaded || isComparing} onClick={handleCompare}>
            {isComparing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando con IA... / Analyzing with AI...</>
            ) : mode === "translation" ? (
              "Comparar Traducción / Compare Translation"
            ) : (
              "Comparar Datos / Compare Data"
            )}
          </Button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {results.totalDiscrepancies === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                Resumen / Summary
              </CardTitle>
              {results.baseFile && (
                <CardDescription>Archivo base / Base file: {results.baseFile}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{results.summary}</p>
              <div className="flex items-center gap-4 mt-4">
                <Badge variant="outline" className="text-sm">
                  {results.totalDiscrepancies} discrepancia(s) / discrepancy(ies)
                </Badge>
                {results.discrepancies.length > 0 && (
                  <Button variant="outline" size="sm" onClick={downloadReport}>
                    <Download className="h-4 w-4 mr-1" /> Descargar Reporte
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Discrepancies table */}
          {results.discrepancies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Detalle de Discrepancias / Discrepancy Details
                </CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Severidad</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Archivo Origen / Source</TableHead>
                      <TableHead>Ubicación / Location</TableHead>
                      <TableHead>Valor / Value</TableHead>
                      <TableHead>Archivo Destino / Target</TableHead>
                      <TableHead>Ubicación / Location</TableHead>
                      <TableHead>Valor / Value</TableHead>
                      <TableHead>Corrección / Correction</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.discrepancies.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs">{d.id}</TableCell>
                        <TableCell>
                          <Badge variant={severityColor[d.severity] as any}>
                            {severityLabel[d.severity] || d.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{d.type}</TableCell>
                        <TableCell className="text-xs font-medium">{d.sourceFile}</TableCell>
                        <TableCell className="text-xs font-mono">{d.sourceLocation}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={d.sourceText || d.sourceValue}>
                          {d.sourceText || d.sourceValue || "—"}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{d.targetFile}</TableCell>
                        <TableCell className="text-xs font-mono">{d.targetLocation}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={d.targetText || d.targetValue}>
                          {d.targetText || d.targetValue || "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate text-primary" title={d.correctTranslation || d.expectedValue}>
                          {d.correctTranslation || d.expectedValue || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Detailed cards for each discrepancy */}
          {results.discrepancies.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Explicaciones Detalladas / Detailed Explanations</h3>
              {results.discrepancies.map((d) => (
                <Card key={d.id} className={d.severity === "critical" ? "border-destructive/50" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Badge variant={severityColor[d.severity] as any} className="mt-0.5 shrink-0">
                        #{d.id} {severityLabel[d.severity]}
                      </Badge>
                      <div className="space-y-1 min-w-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold">{d.sourceFile}</p>
                            <p className="font-mono text-muted-foreground">{d.sourceLocation}</p>
                            <p className="mt-1 break-words">{d.sourceText || d.sourceValue}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold">{d.targetFile}</p>
                            <p className="font-mono text-muted-foreground">{d.targetLocation}</p>
                            <p className="mt-1 break-words">{d.targetText || d.targetValue}</p>
                          </div>
                        </div>
                        {(d.correctTranslation || d.expectedValue) && (
                          <p className="text-xs text-primary">
                            ✓ {d.correctTranslation || d.expectedValue}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">{d.explanation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ComparisonTab;
