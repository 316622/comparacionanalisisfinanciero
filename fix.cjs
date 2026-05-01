const fs = require('fs');
let c = fs.readFileSync('supabase/functions/compare-documents/index.ts', 'utf8');

// Reemplazar extractNums - buscar inicio y fin exactos
const startMarker = 'const extractNums = (text: string): Set<string> => {';
const endMarker = '  };\n\n  // Comparar el documento completo globalmente';

const startIdx = c.indexOf(startMarker);
const endIdx = c.indexOf(endMarker);

if (startIdx === -1) { console.log('ERROR: startMarker no encontrado'); process.exit(1); }
if (endIdx === -1) { console.log('ERROR: endMarker no encontrado'); process.exit(1); }

console.log('startIdx:', startIdx, 'endIdx:', endIdx);

const newExtractNums = `const extractNums = (text: string): Set<string> => {
    const result = new Set<string>();
    const tokens = text.match(/[\\d][\\d,.]*/g) || [];
    for (const token of tokens) {
      const clean = token.replace(/,/g, '').replace(/\\./g, '');
      if (clean.length >= 3 && /^\\d+$/.test(clean)) {
        result.add(clean);
      }
    }
    return result;
  };`;

c = c.substring(0, startIdx) + newExtractNums + '\n\n  // Comparar el documento completo globalmente' + c.substring(endIdx + endMarker.length);

fs.writeFileSync('supabase/functions/compare-documents/index.ts', c);
console.log('OK - extractNums reemplazado');
console.log('Tiene tokens:', c.includes('const tokens = text.match'));
