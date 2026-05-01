const fs = require('fs');
let c = fs.readFileSync('supabase/functions/compare-documents/index.ts', 'utf8');

// Mostrar que tiene el extractNums viejo
const idx = c.indexOf('const extractNums');
console.log('extractNums en linea:', c.substring(0, idx).split('\n').length);
console.log('Contenido actual:', c.substring(idx, idx + 200));
