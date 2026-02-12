import jsPDF from "jspdf";
import "jspdf-autotable";

interface Discrepancy {
  id: number;
  type: string;
  severity: string;
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

export const exportComparisonToPDF = (results: ComparisonResult) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setTextColor(0, 67, 169); // primary blue
  doc.text("Reporte de Comparación / Comparison Report", 14, 20);

  // Summary
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const summaryLines = doc.splitTextToSize(results.summary, pageWidth - 28);
  doc.text(summaryLines, 14, 32);

  let yPos = 32 + summaryLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total discrepancias: ${results.totalDiscrepancies}`, 14, yPos);
  if (results.baseFile) {
    yPos += 6;
    doc.text(`Archivo base: ${results.baseFile}`, 14, yPos);
  }

  yPos += 10;

  if (results.discrepancies.length > 0) {
    const tableData = results.discrepancies.map((d) => [
      `#${d.id}`,
      d.severity.toUpperCase(),
      d.type,
      `${d.sourceFile}\n${d.sourceLocation}`,
      d.sourceText || d.sourceValue || "—",
      `${d.targetFile}\n${d.targetLocation}`,
      d.targetText || d.targetValue || "—",
      d.correctTranslation || d.expectedValue || "—",
    ]);

    (doc as any).autoTable({
      startY: yPos,
      head: [["#", "Severidad", "Tipo", "Origen", "Valor", "Destino", "Valor", "Corrección"]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 67, 169], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      columnStyles: {
        0: { cellWidth: 12 },
        1: { cellWidth: 18 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 35 },
        5: { cellWidth: 40 },
        6: { cellWidth: 35 },
        7: { cellWidth: 35 },
      },
      margin: { left: 14, right: 14 },
    });

    // Detailed explanations on new pages
    let currentY = (doc as any).lastAutoTable.finalY + 15;

    results.discrepancies.forEach((d) => {
      if (currentY > doc.internal.pageSize.getHeight() - 30) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(9);
      doc.setTextColor(0, 67, 169);
      doc.text(`#${d.id} [${d.severity.toUpperCase()}] ${d.type}`, 14, currentY);
      currentY += 5;

      doc.setTextColor(60, 60, 60);
      const explLines = doc.splitTextToSize(d.explanation, pageWidth - 28);
      doc.text(explLines, 14, currentY);
      currentY += explLines.length * 4 + 6;
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generado: ${new Date().toLocaleString()} — Página ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`reporte-comparacion-${new Date().toISOString().slice(0, 10)}.pdf`);
};

interface GlossaryTerm {
  term_es: string;
  term_en: string;
  definition?: string | null;
}

export const exportGlossaryToPDF = (terms: GlossaryTerm[], title = "Glosario Financiero / Financial Glossary") => {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(0, 67, 169);
  doc.text(title, 14, 20);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`${terms.length} términos / terms`, 14, 27);

  const tableData = terms.map((t) => [
    t.term_es,
    t.term_en,
    (t.definition || "").slice(0, 120) + ((t.definition || "").length > 120 ? "..." : ""),
  ]);

  (doc as any).autoTable({
    startY: 32,
    head: [["Español", "English", "Definición / Definition"]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 67, 169], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 45 },
      2: { cellWidth: 90 },
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Generado: ${new Date().toLocaleString()} — Página ${i}/${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8
    );
  }

  doc.save(`glosario-${new Date().toISOString().slice(0, 10)}.pdf`);
};
