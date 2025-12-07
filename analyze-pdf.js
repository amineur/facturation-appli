const fs = require('fs');
const pdfLib = require('pdf-parse');

console.log('Keys of pdf:', Object.keys(pdfLib));
const pdf = pdfLib.default || pdfLib;

console.log('Is pdf a function?', typeof pdf === 'function');



const dataBuffer = fs.readFileSync('public/reference.pdf');

pdf(dataBuffer).then(function (data) {
    console.log("--- PDF INFO ---");
    console.log("Pages:", data.numpages);
    console.log("Info:", data.info);
    console.log("--- TEXT CONTENT START ---");
    console.log(data.text);
    console.log("--- TEXT CONTENT END ---");
});
