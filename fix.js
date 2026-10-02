const fs = require('fs');
let content = fs.readFileSync('utils/pdfGenerator.js', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync('utils/pdfGenerator.js', content);
console.log('Fixed file');
