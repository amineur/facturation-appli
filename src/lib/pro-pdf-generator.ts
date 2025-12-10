import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ProTemplate, TemplateBlock, Facture, Societe, Client } from "@/types";

const hexToRgb = (hex: string): [number, number, number] | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : null;
};

/**
 * Generates a PDF based on the Pro Template blocks.
 * Maps screen coordinates (mm) 1:1 to PDF coordinates.
 */
export const generateProTemplatePDF = (
    template: ProTemplate,
    data?: {
        facture?: Facture,
        societe?: Societe,
        client?: Client
    }
): jsPDF => {
    const { pageSettings } = template;

    // Initialize jsPDF with template settings
    const doc = new jsPDF({
        orientation: pageSettings.orientation,
        unit: 'mm',
        format: pageSettings.format
    });

    // Render Blocks
    // Sort by zIndex if needed, though usually render order is enough
    template.blocks.forEach(block => {
        renderBlock(doc, block, data);
    });

    return doc;
};

const renderBlock = (doc: jsPDF, block: TemplateBlock, data?: any) => {
    const x = block.x;
    const y = block.y;
    const w = block.width;
    const h = block.height;

    const style = block.style;
    const rgb = (style.color ? hexToRgb(style.color) : null) || [0, 0, 0];
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);

    // Background Color
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        const bgRgb = hexToRgb(style.backgroundColor);
        if (bgRgb) {
            doc.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);

            if (block.type === 'shape' || block.type === 'text') {
                doc.rect(x, y, w, h, 'F');
            }
        }
    }

    if (block.type === 'text') {
        doc.setFontSize(style.fontSize || 12);

        let fontStyle = 'normal';
        if (style.fontWeight === 'bold') fontStyle = 'bold';
        if (style.fontStyle === 'italic') fontStyle = 'italic';
        if (style.fontWeight === 'bold' && style.fontStyle === 'italic') fontStyle = 'bolditalic';
        doc.setFont(style.fontFamily || 'helvetica', fontStyle);

        // Strip HTML tags for PDF rendering (Basic implementation)
        // In a real pro editor, we would parse the HTML or use a structured content format
        const textContent = block.content.replace(/<[^>]*>/g, '');

        // Handle alignment mapping from block style to jsPDF
        // jsPDF `text` options: { align: 'left' | 'center' | 'right' }
        // Coordinate adjustment needed for center/right
        let finalX = x;
        if (style.textAlign === 'center') finalX = x + (w / 2);
        if (style.textAlign === 'right') finalX = x + w;

        doc.text(textContent, finalX, y + (h / 2), {
            align: style.textAlign || 'left',
            baseline: 'middle',
            maxWidth: w
        });

        // Underline handling manually if needed, or check if jsPDF supports it via options in newer versions
        // Simple manual underline line:
        if (style.underline) {
            const textWidth = doc.getTextWidth(textContent);
            let lineX = x;
            if (style.textAlign === 'center') lineX = finalX - (textWidth / 2);
            if (style.textAlign === 'right') lineX = finalX - textWidth;
            if (style.textAlign === 'right') lineX = finalX - textWidth;
            doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
            doc.line(lineX, y + (h / 2) + 2, lineX + textWidth, y + (h / 2) + 2);
        }
    }

    if (block.type === 'image') {
        try {
            doc.addImage(block.content, 'PNG', x, y, w, h);
        } catch (e) {
            console.warn('Could not render image block', block.id);
        }
    }

    if (block.type === 'line') {
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        doc.setLineWidth(0.5); // Fixed for now, could be dynamic
        doc.line(x, y + h / 2, x + w, y + h / 2);
    }

    if (block.type === 'shape') {
        // Assuming rectangle for now
        // Border
        if (style.borderColor) {
            const borderRgb = hexToRgb(style.borderColor);
            if (borderRgb) doc.setDrawColor(borderRgb[0], borderRgb[1], borderRgb[2]);
            doc.rect(x, y, w, h, 'FD'); // Fill and DrawStr
        } else {
            doc.rect(x, y, w, h, 'F');
        }
    }


    if (block.type === 'table') {
        // Placeholder for table rendering
        // In the real app, this would use data passed to the generator
        if (data?.facture) {
            autoTable(doc, {
                startY: y,
                margin: { left: x, right: 210 - (x + w) }, // Simple margin logic
                tableWidth: w, // Correct property?
                head: [['Description', 'Qté', 'Prix Unit.', 'Total']],
                body: data.facture.items.map((item: any) => [item.description, item.quantite, item.prixUnitaire, item.totalLigne]),
                theme: 'plain',
                styles: {
                    fontSize: style.fontSize || 10,
                    textColor: rgb || [0, 0, 0],
                },
                headStyles: {
                    fillColor: (style.backgroundColor && hexToRgb(style.backgroundColor)) || undefined,
                    textColor: (style.color && hexToRgb(style.color)) || undefined,
                    fontStyle: 'bold'
                }
            });
        } else {
            // Render placeholder table for template edit mode
            autoTable(doc, {
                startY: y,
                margin: { left: x },
                tableWidth: w,
                head: [['Description', 'Qté', 'Prix', 'Total']],
                body: [
                    ['Exemple Produit 1', '2', '100 €', '200 €'],
                    ['Exemple Produit 2', '1', '50 €', '50 €'],
                ],
                theme: 'grid',
                styles: { fontSize: 10 }
            });
        }
    }
};


