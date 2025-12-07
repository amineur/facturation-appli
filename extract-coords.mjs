import fs from 'fs';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// Setup worker
// Since we are in Node, we can't just point to a URL. 
// We usually don't need to set workerSrc if we use the main entry point in older versions, 
// but for v4 we might need to be explicit.
// Let's try to mock the worker or just use the node compatible entry if possible.
// Actually, standard approach in Node is to use the disableWorker option or ensuring standard fonts are available.
// But let's try pointing to the file path.
// Or better: use the 'pdfjs-dist/legacy/build/pdf.js' which might handle it? 
// I am already using legacy. 

// Let's try this:
pdfjsLib.GlobalWorkerOptions.workerSrc = 'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';

const pdfPath = 'public/reference.pdf';
const data = new Uint8Array(fs.readFileSync(pdfPath));

pdfjsLib.getDocument({
    data: data,
    fontExtraProperties: true // Should help
}).promise.then(function (doc) {
    console.log("PDF Loaded. Pages: " + doc.numPages);
    return doc.getPage(1);
}).then(function (page) {
    return page.getTextContent();
}).then(function (textContent) {
    console.log("--- START ITEMS ---");
    textContent.items.forEach(function (item) {
        if (!item.str.trim()) return;
        console.log(JSON.stringify({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            w: item.width,
            h: item.height
        }));
    });
    console.log("--- END ITEMS ---");
}).catch(function (err) {
    console.error("Error: " + err);
});
