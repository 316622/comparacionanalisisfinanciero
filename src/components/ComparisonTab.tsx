import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Loader2, Languages, Database, FileCheck } from "lucide-react";

type ComparisonMode = "translation" | "data" | null;
type BaseFile = "file1" | "file2";

interface FileSlot {
  label: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
}

const ComparisonTab = () => {
  const [mode, setMode] = useState<ComparisonMode>(null);
  const [baseFile, setBaseFile] = useState<BaseFile>("file1");
  const [files, setFiles] = useState<FileSlot[]>([
    { label: "Excel File 1 (ES)", accept: ".xlsx,.xls,.csv", icon: <FileSpreadsheet className="h-6 w-6" />, file: null },
    { label: "Excel File 2 (EN)", accept: ".xlsx,.xls,.csv", icon: <FileSpreadsheet className="h-6 w-6" />, file: null },
    { label: "Word File 1 (ES)", accept: ".docx,.doc", icon: <FileText className="h-6 w-6" />, file: null },
    { label: "Word File 2 (EN)", accept: ".docx,.doc", icon: <FileText className="h-6 w-6" />, file: null },
  ]);
  const [isComparing, setIsComparing] = useState(false);
  const [results, setResults] = useState<null | string>(null);

  const handleFileChange = useCallback((index: number, file: File | null) => {
    setFiles((prev) => prev.map((slot, i) => (i === index ? { ...slot, file } : slot)));
    setResults(null);
  }, []);

  const allUploaded = files.every((f) => f.file !== null);

  const handleCompare = async () => {
    setIsComparing(true);
    setTimeout(() => {
      setResults(
        mode === "translation"
          ? "Comparación de Traducción: Se verificará si la traducción entre los documentos es correcta y fiel al original.\n\nTranslation Comparison: Will verify if the translation between documents is accurate and faithful to the original.\n\n(Requiere Lovable Cloud / Requires Lovable Cloud)"
          : `Comparación de Datos: Se tomarán los datos del archivo base (${baseFile === "file1" ? "Archivo 1 / File 1" : "Archivo 2 / File 2"}), se traducirán y compararán con el otro archivo para encontrar discrepancias.\n\nData Comparison: Data from the base file (${baseFile === "file1" ? "File 1" : "File 2"}) will be translated and compared against the other file to find discrepancies.\n\n(Requiere Lovable Cloud / Requires Lovable Cloud)`
      );
      setIsComparing(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Step 1: Choose comparison mode */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Paso 1: Tipo de Comparación / Step 1: Comparison Type
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              mode === "translation"
                ? "ring-2 ring-primary border-primary"
                : "hover:border-primary/40"
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
              mode === "data"
                ? "ring-2 ring-primary border-primary"
                : "hover:border-primary/40"
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

      {/* Step 2: Base file selector (only for data comparison) */}
      {mode === "data" && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Paso 2: Archivo Base / Step 2: Base File
          </h3>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Seleccione el archivo principal / Select the main file
                </p>
                <p className="text-xs text-muted-foreground">
                  Este archivo se usará como referencia base para la comparación / This file will be used as the base reference for comparison
                </p>
              </div>
              <Select value={baseFile} onValueChange={(v) => setBaseFile(v as BaseFile)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file1">Archivo 1 / File 1 (ES)</SelectItem>
                  <SelectItem value="file2">Archivo 2 / File 2 (EN)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </div>
      )}

      {/* Step 3: Upload files */}
      {mode && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">
            {mode === "data" ? "Paso 3" : "Paso 2"}: Subir Archivos / Upload Files
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {files.map((slot, idx) => (
              <Card key={idx} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {slot.icon} {slot.label}
                    {mode === "data" && (
                      (baseFile === "file1" && (idx === 0 || idx === 2)) ||
                      (baseFile === "file2" && (idx === 1 || idx === 3))
                    ) && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Base
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors">
                    {slot.file ? (
                      <div className="text-center">
                        <p className="text-sm font-medium truncate max-w-[200px]">{slot.file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(slot.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Upload className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">Click para subir / Click to upload</p>
                      </div>
                    )}
                    <input
                      type="file"
                      accept={slot.accept}
                      className="hidden"
                      onChange={(e) => handleFileChange(idx, e.target.files?.[0] || null)}
                    />
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
          <Button
            size="lg"
            disabled={!allUploaded || isComparing}
            onClick={handleCompare}
          >
            {isComparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Comparando / Comparing...
              </>
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
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Resultados de Comparación / Comparison Results
            </CardTitle>
            <CardDescription>
              {mode === "translation"
                ? "Análisis de traducción / Translation analysis"
                : "Discrepancias de datos encontradas / Data discrepancies found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground">{results}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ComparisonTab;
