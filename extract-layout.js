const fs = require('fs');
const PDFParser = require('pdf2json');

const pdfParser = new PDFParser();

pdfParser.on('pdfParser_dataError', errData => console.error(errData.parserError));
pdfParser.on('pdfParser_dataReady', pdfData => {
    // Output the full structure for page 1
    const page1 = pdfData.Pages[0];

    console.log("=== PAGE 1 LAYOUT DATA ===");
    console.log("Width:", page1.Width, "Height:", page1.Height);
    console.log("\n=== TEXT ELEMENTS ===");

    page1.Texts.forEach((text, idx) => {
        // Decode the text content
        const content = decodeURIComponent(text.R[0].T);
        const x = text.x;
        const y = text.y;
        const fontSize = text.R[0].TS ? text.R[0].TS[1] : 'N/A';
        const fontStyle = text.R[0].TS ? text.R[0].TS[2] : 0; // 0=normal, 1=bold, 2=italic, 3=bold+italic

        console.log(JSON.stringify({
            idx: idx,
            text: content,
            x: x,
            y: y,
            fontSize: fontSize,
            bold: fontStyle === 1 || fontStyle === 3
        }));
    });

    console.log("\n=== LINES/FILLS (Table Structure) ===");
    if (page1.Fills) {
        page1.Fills.forEach((fill, idx) => {
            console.log(JSON.stringify({
                type: 'fill',
                x: fill.x,
                y: fill.y,
                w: fill.w,
                h: fill.h,
                color: fill.clr
            }));
        });
    }

    if (page1.HLines) {
        page1.HLines.forEach((line, idx) => {
            console.log(JSON.stringify({
                type: 'hline',
                x: line.x,
                y: line.y,
                w: line.w
            }));
        });
    }
});

pdfParser.loadPDF('public/reference.pdf');
