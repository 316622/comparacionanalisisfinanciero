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
type DocType = "excel" | "word" | null;

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
  // Translation mode states (original 4-slot layout)
  const [transExcelES, setTransExcelES] = useState<File | null>(null);
  const [transExcelEN, setTransExcelEN] = useState<File | null>(null);
  const [transWordES, setTransWordES] = useState<File | null>(null);
  const [transWordEN, setTransWordEN] = useState<File | null>(null);
  // Data mode states (sequential dropdown)
  const [docType, setDocType] = useState<DocType>(null);
  const [langPair, setLangPair] = useState<LangPair>("es-en");
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<ComparisonResult | null>(null);

  const lp = langPairLabels[langPair];
  const accept = docType === "excel" ? ".xlsx,.xls,.csv" : ".docx,.doc";
  const DocIcon = docType === "excel" ? FileSpreadsheet : FileText;

  const dataBothUploaded = file1 !== null && file2 !== null;
  const translationHasFiles = transExcelES !== null && transExcelEN !== null && transWordES !== null && transWordEN !== null;
  const canCompare = mode === "translation" ? translationHasFiles : (mode === "data" && dataBothUploaded);

  const handleCompare = async () => {
    if (!mode) return;

    if (mode === "translation" && !translationHasFiles) return;
    if (mode === "data" && (!docType || !file1 || !file2)) return;

    setIsComparing(true);
    setResults(null);

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
                      <SelectItem value="es-en">Español vs English</SelectItem>
                      <SelectItem value="es-es">Español vs Español</SelectItem>
                      <SelectItem value="en-en">English vs English</SelectItem>
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
                  const fileLabel = idx === 0 ? `${docType === "excel" ? "Excel" : "Word"} File 1 (${lp.file1})` : `${docType === "excel" ? "Excel" : "Word"} File 2 (${lp.file2})`;
                  const currentFile = idx === 0 ? file1 : file2;
                  const setFile = idx === 0 ? setFile1 : setFile2;
                  return (
                    <Card key={idx} className="relative">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <DocIcon className="h-6 w-6" /> {fileLabel}
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
                          <input type="file" accept={accept} className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setResults(null); }} />
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
