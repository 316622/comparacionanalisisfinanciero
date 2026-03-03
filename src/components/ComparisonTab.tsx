import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Loader2, Languages, Database, FileCheck, Download, CheckCircle2, BookOpen, FileDown, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/hooks/useAuditLog";
import { exportComparisonToPDF } from "@/lib/exportPDF";
import { useAuth } from "@/hooks/useAuth";

type ComparisonMode = "translation" | "data" | null;
type PrimaryLanguage = "es" | "en";
type LangPair = "es-en" | "es-es" | "en-en" | "en-es";
type DocType = "excel" | "word" | "excel-word" | null;

const langPairLabels: Record<LangPair, { file1: string; file2: string; label: string }> = {
  "es-en": { file1: "ES", file2: "EN", label: "Español vs English" },
  "es-es": { file1: "ES", file2: "ES", label: "Español vs Español" },
  "en-en": { file1: "EN", file2: "EN", label: "English vs English" },
  "en-es": { file1: "EN", file2: "ES", label: "English vs Español" },
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
  const { user } = useAuth();
  const [mode, setMode] = useState<ComparisonMode>(null);
  const [primaryLang, setPrimaryLang] = useState<PrimaryLanguage>("es");
  const [transExcelES, setTransExcelES] = useState<File | null>(null);
  const [transExcelEN, setTransExcelEN] = useState<File | null>(null);
  const [transWordES, setTransWordES] = useState<File | null>(null);
  const [transWordEN, setTransWordEN] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocType>(null);
  const [langPair, setLangPair] = useState<LangPair>("es-en");
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<ComparisonResult | null>(null);
  const [suggestedTerms, setSuggestedTerms] = useState<Array<{ term_es: string; term_en: string; definition: string }>>([]);
  const [extractingTerms, setExtractingTerms] = useState(false);
  const [addingTerm, setAddingTerm] = useState<number | null>(null);
  const lp = langPairLabels[langPair];
  const accept1 = docType === "excel" ? ".xlsx,.xls,.csv" : docType === "word" ? ".docx,.doc" : ".xlsx,.xls,.csv";
  const accept2 = docType === "excel" ? ".xlsx,.xls,.csv" : docType === "word" ? ".docx,.doc" : ".docx,.doc";
  const DocIcon1 = docType === "word" ? FileText : FileSpreadsheet;
  const DocIcon2 = docType === "excel" ? FileSpreadsheet : FileText;

  const dataBothUploaded = file1 !== null && file2 !== null;
  const translationHasFiles = transExcelES !== null && transExcelEN !== null && transWordES !== null && transWordEN !== null;
  const canCompare = mode === "translation" ? translationHasFiles : (mode === "data" && dataBothUploaded);

  const handleCompare = async () => {
    if (!mode) return;

    if (mode === "translation" && !translationHasFiles) return;
    if (mode === "data" && (!docType || !file1 || !file2)) return;

    setIsComparing(true);
    setResults(null);
    logAuditEvent("comparison_started", { mode, docType, langPair });

    try {
      const formData = new FormData();
      formData.append("mode", mode);

      if (mode === "translation") {
        formData.append("primaryLang", primaryLang);
        formData.append("file1", transExcelES!);
        formData.append("file2", transExcelEN!);
        formData.append("file3", transWordES!);
        formData.append("file4", transWordEN!);
        formData.append("docType", "all");
        formData.append("langPair", "es-en");
      } else {
        formData.append("docType", docType!);
        formData.append("langPair", langPair);
        formData.append("file1", file1!);
        formData.append("file2", file2!);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Debes iniciar sesión para comparar documentos. / You must sign in to compare documents.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data: ComparisonResult = await response.json();
      
      // Replace generic "File 1/File 2" labels with actual filenames
      const fileName1 = mode === "translation" ? transExcelES!.name : file1!.name;
      const fileName2 = mode === "translation" ? transExcelEN!.name : file2!.name;
      const replaceFileLabels = (text: string) => {
        return text
          .replace(/File 1 \([^)]*\)/g, fileName1)
          .replace(/File 2 \([^)]*\)/g, fileName2);
      };
      
      data.summary = replaceFileLabels(data.summary);
      if (data.baseFile) data.baseFile = replaceFileLabels(data.baseFile);
      data.discrepancies = data.discrepancies.map(d => ({
        ...d,
        sourceFile: replaceFileLabels(d.sourceFile),
        targetFile: replaceFileLabels(d.targetFile),
        explanation: replaceFileLabels(d.explanation),
      }));
      
      setResults(data);
      logAuditEvent("comparison_completed", { mode, discrepancies: data.totalDiscrepancies });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsComparing(false);
    }
  };

  const downloadReport = () => {
    if (!results) return;
    const lines: string[] = [];
    lines.push("=== REPORTE DE COMPARACIÓN ===\n");
    lines.push(results.summary + "\n");
    lines.push(`Total de discrepancias: ${results.totalDiscrepancies}\n`);
    if (results.baseFile) lines.push(`Archivo base: ${results.baseFile}\n`);
    lines.push("\n--- DISCREPANCIAS ---\n");

    results.discrepancies.forEach((d) => {
      lines.push(`#${d.id} [${d.severity.toUpperCase()}] ${d.type}`);
      lines.push(`  Origen: ${d.sourceFile} → ${d.sourceLocation}`);
      lines.push(`  Valor: ${d.sourceText || d.sourceValue || "N/A"}`);
      lines.push(`  Destino: ${d.targetFile} → ${d.targetLocation}`);
      lines.push(`  Valor: ${d.targetText || d.targetValue || "N/A"}`);
      if (d.correctTranslation) lines.push(`  Traducción correcta: ${d.correctTranslation}`);
      if (d.expectedValue) lines.push(`  Valor esperado: ${d.expectedValue}`);
      lines.push(`  Explicación: ${d.explanation}`);
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

  const handleExtractTerms = async () => {
    if (!results) return;
    setExtractingTerms(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-glossary-terms", {
        body: {
          comparisonSummary: results.summary,
          discrepancies: results.discrepancies,
        },
      });
      if (error) throw error;
      setSuggestedTerms(data.suggestions || []);
      if ((data.suggestions || []).length === 0) {
        toast({ title: "Info", description: "No se encontraron términos nuevos para sugerir." });
      }
    } catch {
      toast({ title: "Error", description: "Error al extraer términos.", variant: "destructive" });
    }
    setExtractingTerms(false);
  };

  const handleAddSuggestedTerm = async (idx: number) => {
    if (!user) return;
    const term = suggestedTerms[idx];
    setAddingTerm(idx);
    const { error } = await supabase.from("glossary_terms" as any).insert({
      term_es: term.term_es,
      term_en: term.term_en,
      definition: term.definition,
    } as any);
    if (error) {
      toast({ title: "Error", description: "No se pudo agregar. / Could not add.", variant: "destructive" });
    } else {
      toast({ title: "✓", description: `"${term.term_es}" agregado al glosario.` });
      setSuggestedTerms((prev) => prev.filter((_, i) => i !== idx));
      logAuditEvent("glossary_term_created", { term_es: term.term_es, source: "auto-extract" });
    }
    setAddingTerm(null);
  };

  return (
    <div className="space-y-6">
      {/* Confidentiality notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Confidencialidad / Confidentiality</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Los archivos subidos se procesan temporalmente en memoria y <strong>no se almacenan</strong> en ningún servidor ni base de datos. Son descartados inmediatamente después del análisis.
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
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
            className={`cursor-pointer transition-all rounded-2xl hover:scale-[1.01] ${
              mode === "translation" ? "ring-2 ring-primary border-primary shadow-md" : "hover:border-primary/40"
            }`}
            style={{ boxShadow: mode === "translation" ? undefined : "var(--shadow-card)" }}
            onClick={() => { setMode("translation"); setResults(null); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                  <Languages className="h-5 w-5 text-primary" />
                </div>
                Comparación de Traducción
              </CardTitle>
              <CardDescription>Translation Comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Verifica si la traducción entre los documentos es correcta y precisa.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Checks if the translation between documents is correct and accurate.
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all rounded-2xl hover:scale-[1.01] ${
              mode === "data" ? "ring-2 ring-primary border-primary shadow-md" : "hover:border-primary/40"
            }`}
            style={{ boxShadow: mode === "data" ? undefined : "var(--shadow-card)" }}
            onClick={() => { setMode("data"); setResults(null); }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-primary/10">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                Comparación de Datos
              </CardTitle>
              <CardDescription>Data Comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Extrae datos de un archivo base, los traduce y compara con el otro para encontrar discrepancias.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Extracts data from a base file, translates it, and compares with the other to find discrepancies.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ===== TRANSLATION MODE: Original 4-slot layout ===== */}
      {mode === "translation" && (
        <>
          {/* Step 2: Primary language */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Paso 2: Archivo Principal / Step 2: Primary File
            </h3>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">¿Cuál es el idioma principal? / Which is the primary language?</p>
                  <p className="text-xs text-muted-foreground">
                    Las traducciones se verificarán hacia el otro idioma / Translations will be verified toward the other language
                  </p>
                </div>
                <Select value={primaryLang} onValueChange={(v) => setPrimaryLang(v as PrimaryLanguage)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español (ES)</SelectItem>
                    <SelectItem value="en">English (EN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </div>

          {/* Step 3: Upload 4 files */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Paso 3: Subir Archivos / Step 3: Upload Files
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { label: "Excel File (ES)", file: transExcelES, setFile: setTransExcelES, acceptType: ".xlsx,.xls,.csv", Icon: FileSpreadsheet },
                { label: "Excel File (EN)", file: transExcelEN, setFile: setTransExcelEN, acceptType: ".xlsx,.xls,.csv", Icon: FileSpreadsheet },
                { label: "Word File (ES)", file: transWordES, setFile: setTransWordES, acceptType: ".docx,.doc", Icon: FileText },
                { label: "Word File (EN)", file: transWordEN, setFile: setTransWordEN, acceptType: ".docx,.doc", Icon: FileText },
              ]).map((slot, idx) => (
                <Card key={idx} className="relative">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <slot.Icon className="h-6 w-6" /> {slot.label}
                      {((primaryLang === "es" && idx % 2 === 0) || (primaryLang === "en" && idx % 2 === 1)) && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Base</span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                      {slot.file ? (
                        <div className="text-center">
                          <p className="text-sm font-medium truncate max-w-[200px]">{slot.file.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{(slot.file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Upload className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-sm">Click para subir / Click to upload</p>
                        </div>
                      )}
                      <input type="file" accept={slot.acceptType} className="hidden" onChange={(e) => { slot.setFile(e.target.files?.[0] || null); setResults(null); }} />
                    </label>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Compare button */}
          <div className="flex justify-center">
            <Button size="lg" disabled={!canCompare || isComparing} onClick={handleCompare}>
              {isComparing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando con IA... / Analyzing with AI...</>
              ) : (
                "Comparar Traducción / Compare Translation"
              )}
            </Button>
          </div>
        </>
      )}

      {/* ===== DATA MODE: Sequential dropdown workflow ===== */}
      {mode === "data" && (
        <>
          {/* Step 2: Document type */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Paso 2: Tipo de Documento / Step 2: Document Type
            </h3>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">¿Qué tipo de documento? / What document type?</p>
                </div>
                <Select value={docType ?? ""} onValueChange={(v) => { setDocType(v as DocType); setFile1(null); setFile2(null); setResults(null); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Excel</span>
                    </SelectItem>
                    <SelectItem value="word">
                      <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Word</span>
                    </SelectItem>
                    <SelectItem value="excel-word">
                      <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Word vs Excel</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </div>

          {/* Step 3: Language pair */}
          {docType && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Paso 3: Idiomas / Step 3: Languages
              </h3>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Languages className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Combinación de idiomas / Language combination</p>
                  </div>
                  <Select value={langPair} onValueChange={(v) => { setLangPair(v as LangPair); setResults(null); }}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {docType === "excel-word" ? (
                        <>
                          <SelectItem value="es-en">Excel Español / Word English</SelectItem>
                          <SelectItem value="en-es">Excel English / Word Español</SelectItem>
                          <SelectItem value="en-en">Excel English / Word English</SelectItem>
                          <SelectItem value="es-es">Excel Español / Word Español</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="es-en">Español vs English</SelectItem>
                          <SelectItem value="es-es">Español vs Español</SelectItem>
                          <SelectItem value="en-en">English vs English</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            </div>
          )}

          {/* Step 4: Upload 2 files */}
          {docType && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Paso 4: Subir Archivos / Step 4: Upload Files
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[0, 1].map((idx) => {
                  const isExcelSlot = docType === "excel" || (docType === "excel-word" && idx === 0);
                  const isWordSlot = docType === "word" || (docType === "excel-word" && idx === 1);
                  const formatLabel = isExcelSlot ? "Excel" : "Word";
                  const fileLabel = `${formatLabel} File ${idx + 1} (${idx === 0 ? lp.file1 : lp.file2})`;
                  const currentFile = idx === 0 ? file1 : file2;
                  const setFile = idx === 0 ? setFile1 : setFile2;
                  const SlotIcon = isExcelSlot ? FileSpreadsheet : FileText;
                  const slotAccept = isExcelSlot ? ".xlsx,.xls,.csv" : ".docx,.doc";
                  return (
                    <Card key={idx} className="relative">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <SlotIcon className="h-6 w-6" /> {fileLabel}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                          {currentFile ? (
                            <div className="text-center">
                              <p className="text-sm font-medium truncate max-w-[200px]">{currentFile.name}</p>
                              <p className="text-xs text-muted-foreground mt-1">{(currentFile.size / 1024).toFixed(1)} KB</p>
                            </div>
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <Upload className="h-8 w-8 mx-auto mb-2" />
                              <p className="text-sm">Click para subir / Click to upload</p>
                            </div>
                          )}
                          <input type="file" accept={slotAccept} className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setResults(null); }} />
                        </label>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compare button */}
          {docType && (
            <div className="flex justify-center">
              <Button size="lg" disabled={!canCompare || isComparing} onClick={handleCompare}>
                {isComparing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando con IA... / Analyzing with AI...</>
                ) : (
                  "Comparar Datos / Compare Data"
                )}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
               {results.totalDiscrepancies === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                )}
                Resumen
              </CardTitle>
              {results.baseFile && (
                <CardDescription>Archivo base: {results.baseFile}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{results.summary}</p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <Badge variant="outline" className="text-sm">
                  {results.totalDiscrepancies} discrepancia(s)
                </Badge>
                {results.discrepancies.length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={downloadReport}>
                      <Download className="h-4 w-4 mr-1" /> TXT
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportComparisonToPDF(results)}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                  </>
                )}
                {user && results.discrepancies.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={handleExtractTerms} disabled={extractingTerms}>
                    {extractingTerms ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BookOpen className="h-4 w-4 mr-1" />}
                    Extraer Términos
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>



          {/* Detailed cards for each discrepancy */}
          {results.discrepancies.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Explicaciones Detalladas</h3>
              {results.discrepancies.map((d) => (
                <Card key={d.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="mt-0.5 shrink-0 font-mono">
                        #{d.id}
                      </Badge>
                      <div className="space-y-1 min-w-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold">{d.sourceFile}</p>
                            <p className="font-mono font-bold text-foreground">{d.sourceLocation}</p>
                            <p className="mt-1 break-words">{d.sourceText || d.sourceValue}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <p className="font-semibold">{d.targetFile}</p>
                            <p className="font-mono font-bold text-foreground">{d.targetLocation}</p>
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

      {/* Suggested terms from extraction */}
      {suggestedTerms.length > 0 && (
        <Card className="border-accent/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-accent" />
              Términos Sugeridos ({suggestedTerms.length})
            </CardTitle>
            <CardDescription>
              Términos extraídos del análisis. Haz clic en "+" para agregar al glosario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestedTerms.map((term, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border bg-card p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{term.term_es} / {term.term_en}</p>
                    <p className="text-xs text-muted-foreground mt-1">{term.definition}</p>
                  </div>
                  {user && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      disabled={addingTerm === idx}
                      onClick={() => handleAddSuggestedTerm(idx)}
                    >
                      {addingTerm === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComparisonTab;
