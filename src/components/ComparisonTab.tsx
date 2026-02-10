import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, FileText, AlertTriangle, Loader2 } from "lucide-react";

interface FileSlot {
  label: string;
  accept: string;
  icon: React.ReactNode;
  file: File | null;
}

const ComparisonTab = () => {
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
    // Placeholder — will integrate with AI backend
    setTimeout(() => {
      setResults("La comparación con IA requiere la activación del backend (Lovable Cloud). Una vez habilitado, los documentos serán analizados automáticamente.\n\nThe AI comparison requires backend activation (Lovable Cloud). Once enabled, documents will be analyzed automatically.");
      setIsComparing(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {files.map((slot, idx) => (
          <Card key={idx} className="relative">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {slot.icon} {slot.label}
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
          ) : (
            "Comparar Documentos / Compare Documents"
          )}
        </Button>
      </div>

      {results && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Resultados de Comparación / Comparison Results
            </CardTitle>
            <CardDescription>
              Diferencias encontradas / Discrepancies found
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
