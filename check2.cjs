const fs = require('fs');
let c = fs.readFileSync('supabase/functions/compare-documents/index.ts', 'utf8');

const idx = c.indexOf('const extractNums');
// Mostrar 600 caracteres desde donde empieza extractNums
console.log(JSON.stringify(c.substring(idx, idx + 600)));
