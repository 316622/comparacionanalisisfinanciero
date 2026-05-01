const fs = require('fs');
let c = fs.readFileSync('supabase/functions/compare-documents/index.ts', 'utf8');
console.log('Lineas:', c.split('\n').length);
console.log('Tiene ZipReader:', c.includes('ZipReader'));
console.log('Tiene TextDecoder en parse:', c.includes('const decoder = new TextDecoder()'));
console.log('Tiene tokens:', c.includes('const tokens = text.match'));
