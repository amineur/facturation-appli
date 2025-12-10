import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Facture, Devis, Societe, Client, PdfTemplate } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { dataService } from "./data-service";

// Helper: Hex to RGB
const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
        : [0, 0, 0];
};

export const generateInvoicePDF = (
    document: Facture | Devis,
    societe: Societe,
    client: Client,
    options?: {
        returnBlob?: boolean;
        returnBase64?: boolean;
        templateOverride?: PdfTemplate;
    }
) => {
    try {
        // Load Layout Config
        const template: PdfTemplate = options?.templateOverride || dataService.getPdfTemplate();

        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const PAGE_WIDTH = 210;
        const PAGE_HEIGHT = 297;

        const isFacture = "type" in document ? document.type === "Facture" : true;
        const documentTitle = isFacture ? (template.labels?.factureTitle || "FACTURE") : (template.labels?.devisTitle || "DEVIS");
        const documentNumber = document.numero;

        // Colors
        const COLOR_PRIMARY = hexToRgb(template.primaryColor);
        const COLOR_SECONDARY = hexToRgb(template.secondaryColor);
        const COLOR_TEXT = hexToRgb(template.textColor);
        const COLOR_ACCENT = hexToRgb(template.accentColor);

        // Fonts
        const FONT = template.fontFamily; // 'helvetica', 'times', 'courier'

        // Formatted Dates
        let dateEmission = "";
        let dateEcheance = "";
        if (document.dateEmission) {
            dateEmission = format(new Date(document.dateEmission), "dd.MM.yy", { locale: fr });
        }
        if (isFacture && 'echeance' in document && document.echeance) {
            dateEcheance = format(new Date(document.echeance), "dd.MM.yy", { locale: fr });
        }

        // ==========================================
        // 1. HEADER
        // ==========================================
        let y = template.marginTop;

        // --- SIRET TOP OPTION ---
        if (template.showSiretTop && societe.siret) {
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            const text = `SIRET: ${societe.siret}`;
            if (template.headerStyle === 'centered') {
                doc.text(text, PAGE_WIDTH / 2, y, { align: "center" });
            } else {
                doc.text(text, template.marginLeft, y);
            }
            y += 6;
        }

        // --- LOGO & TITLE ---
        const logoH = 15;
        const logoW = (template.logoSize || 40);

        if (template.headerStyle === 'centered') {
            // CENTERED LAYOUT
            if (societe.logoUrl) {
                try {
                    doc.addImage(societe.logoUrl, 'JPEG', (PAGE_WIDTH - logoW) / 2, y, logoW, logoH);
                } catch (e) { }
            } else {
                doc.setFontSize(template.titleSize * 0.8);
                doc.setFont(FONT, "bold");
                doc.setTextColor(...COLOR_PRIMARY);
                doc.text(societe.nom.toUpperCase(), PAGE_WIDTH / 2, y + 10, { align: "center" });
            }
            y += logoH + 10;

            doc.setFontSize(template.titleSize);
            doc.setFont(FONT, "bold");
            doc.setTextColor(...COLOR_PRIMARY);
            doc.text(`${documentTitle} ${documentNumber}`, PAGE_WIDTH / 2, y, { align: "center" });

            y += 6;
            doc.setFontSize(template.bodySize);
            doc.setFont(FONT, "normal");
            doc.setTextColor(...COLOR_SECONDARY);
            doc.text(`${template.labels?.dateEmission || "Date :"} ${dateEmission}`, PAGE_WIDTH / 2, y, { align: "center" });

        } else {
            // STANDARD / MINIMAL (Left/Right)
            // Left: Logo
            if (societe.logoUrl) {
                try {
                    doc.addImage(societe.logoUrl, 'JPEG', template.marginLeft, y, logoW, logoH);
                } catch (e) { }
            } else {
                // Txt Fallback
                doc.setFontSize(template.titleSize * 0.7);
                doc.setFont(FONT, "bold");
                doc.setTextColor(...COLOR_PRIMARY);
                doc.text(societe.nom.toUpperCase(), template.marginLeft, y + 10);
            }

            // Right: Title Block
            const xRight = PAGE_WIDTH - template.marginRight;
            doc.setFontSize(template.titleSize);
            doc.setFont(FONT, "bold");
            doc.setTextColor(...COLOR_PRIMARY);
            doc.text(`${documentTitle}`, xRight, y + 8, { align: "right" });

            doc.setFontSize(template.titleSize * 0.6);
            doc.setTextColor(...COLOR_SECONDARY);
            doc.text(`${documentNumber}`, xRight, y + 16, { align: "right" });

            doc.setFontSize(template.bodySize);
            doc.setFont(FONT, "normal");
            doc.text(`${template.labels?.dateEmission || "Date :"} ${dateEmission}`, xRight, y + 22, { align: "right" });
            if (dateEcheance) {
                doc.text(`${template.labels?.dateEcheance || "Échéance :"} ${dateEcheance}`, xRight, y + 26, { align: "right" });
            }
        }

        // ==========================================
        // 2. ADDRESSES
        // ==========================================
        // Determine layout based on mode
        const yAddresses = y + 35; // Space after header

        doc.setFontSize(template.bodySize);
        doc.setTextColor(...COLOR_TEXT);

        // Emitter
        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text(societe.nom, template.marginLeft, yAddresses);

        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);
        let yEmitter = yAddresses + 5;
        (societe.adresse || "").split('\n').forEach(line => {
            doc.text(line, template.marginLeft, yEmitter);
            yEmitter += 4.5;
        });
        doc.text(`${societe.codePostal || ""} ${societe.ville || ""}`, template.marginLeft, yEmitter);
        yEmitter += 4.5;
        if (societe.email) doc.text(societe.email, template.marginLeft, yEmitter + 4.5);

        // Client
        const xClient = template.layoutMode === 'minimalist' ? 120 : PAGE_WIDTH / 2 + 10;

        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text(client.nom, xClient, yAddresses);

        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);
        let yClient = yAddresses + 5;
        (client.adresse || "").split('\n').forEach(line => {
            doc.text(line, xClient, yClient);
            yClient += 4.5;
        });
        doc.text(`${client.codePostal || ""} ${client.ville || ""}`, xClient, yClient);

        // ==========================================
        // 3. TABLE
        // ==========================================
        const yTable = Math.max(yEmitter, yClient) + 20;

        const columns = [{ header: template.labels?.description || "Description", dataKey: "description" }];
        if (template.showDate) columns.push({ header: "Date", dataKey: "date" });
        if (template.showQuantite) columns.push({ header: template.labels?.quantite || "Qté", dataKey: "quantite" });
        columns.push({ header: template.labels?.prixUnitaire || "Prix Unit.", dataKey: "prixUnitaire" });
        if (template.showTva) columns.push({ header: template.labels?.tva || "TVA", dataKey: "tva" });
        if (template.showRemise) columns.push({ header: template.labels?.remise || "Remise", dataKey: "remise" });
        columns.push({ header: template.labels?.montant || "Montant", dataKey: "montant" });

        const tableBody = document.items.map(item => {
            const pu = typeof item.prixUnitaire === 'number' ? item.prixUnitaire : 0;
            const qty = typeof item.quantite === 'number' ? item.quantite : 1;
            const tva = typeof item.tva === 'number' ? item.tva : 0;
            const montantHT = pu * qty;

            // Rich text strip
            const cleanDesc = (item.description || "").replace(/<[^>]*>?/gm, '');

            return {
                description: cleanDesc,
                date: (item as any).date ? format(new Date((item as any).date), "dd.MM.yy") : "",
                quantite: qty.toFixed(2).replace('.', ','),
                prixUnitaire: `${pu.toFixed(2).replace('.', ',')} €`,
                tva: `${tva.toFixed(2).replace('.', ',')} %`,
                remise: item.remise ? `${item.remise}` : "-",
                montant: `${montantHT.toFixed(2).replace('.', ',')} €`
            };
        });

        // Table Styles mapping
        const headerBgColor = template.tableStyle === 'plain' ? [255, 255, 255] : hexToRgb(template.tableHeaderBg);
        const headerTextColor = template.tableStyle === 'plain' ? COLOR_PRIMARY : hexToRgb(template.tableHeaderColor);
        const tableLineColor = template.tableBorders ? hexToRgb(template.tableBorderColor) : [230, 230, 230];
        const tableLineWidth = template.tableBorders ? 0.1 : 0;

        autoTable(doc, {
            startY: yTable,
            columns: columns,
            body: tableBody,
            theme: template.tableStyle === 'striped' ? 'striped' : 'plain',
            margin: { left: template.marginLeft, right: template.marginRight },
            styles: {
                font: FONT,
                fontSize: template.bodySize,
                cellPadding: 3,
                textColor: COLOR_TEXT as [number, number, number],
                lineColor: tableLineColor as [number, number, number],
                lineWidth: tableLineWidth,
            },
            headStyles: {
                fontStyle: 'bold',
                fillColor: headerBgColor as [number, number, number],
                textColor: headerTextColor as [number, number, number],
                lineColor: tableLineColor as [number, number, number],
                lineWidth: { bottom: template.tableStyle === 'plain' ? 0.2 : 0 }
            },
            columnStyles: {
                description: { cellWidth: 'auto', halign: 'left' },
                quantite: { halign: 'center' },
                prixUnitaire: { halign: 'right' },
                tva: { halign: 'right' },
                montant: { halign: 'right' }
            }
        });

        const yAfterTable = (doc as any).lastAutoTable.finalY + 10;

        // ==========================================
        // 4. TOTALS
        // ==========================================
        let yTotals = yAfterTable;
        const xTotalsLabel = 140;
        const xTotalsValue = PAGE_WIDTH - template.marginRight;

        doc.setFontSize(template.bodySize);
        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);

        doc.text(template.labels?.totalHT || "Total HT", xTotalsLabel, yTotals);
        doc.text(`${document.totalHT.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
        yTotals += 6;

        const tvaTotal = document.totalTTC - document.totalHT;
        doc.text(template.labels?.tva || "TVA", xTotalsLabel, yTotals);
        doc.text(`${tvaTotal.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
        yTotals += 8;

        if (template.showTtc) {
            doc.setFontSize(template.bodySize + 2);
            doc.setFont(FONT, "bold");
            doc.setTextColor(...COLOR_PRIMARY);
            doc.text(template.labels?.totalTTC || "Total TTC", xTotalsLabel, yTotals);
            doc.text(`${document.totalTTC.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
        }

        // ==========================================
        // 5. BOTTOM / FOOTER INFO
        // ==========================================
        // Determine if we fix to bottom or flow naturally
        let yBottom = yTotals + 20;
        if (template.layoutMode === 'modern' || template.layoutMode === 'minimalist') {
            // Push to bottom area if space permits
            if (yBottom < PAGE_HEIGHT - 60) {
                yBottom = PAGE_HEIGHT - 60;
            }
        }

        if (template.showPaymentInfo) {
            doc.setFontSize(template.bodySize);
            doc.setFont(FONT, "bold");
            doc.setTextColor(...COLOR_PRIMARY);
            doc.text(template.labels?.paymentInfo || "Moyens de paiement :", template.marginLeft, yBottom);

            yBottom += 5;
            doc.setFont(FONT, "normal");
            doc.setTextColor(...COLOR_SECONDARY);

            if (societe.banque) {
                doc.text(`Banque : ${societe.banque}`, template.marginLeft, yBottom);
                yBottom += 5;
            }
            if (societe.iban) {
                doc.text(`IBAN : ${societe.iban}`, template.marginLeft, yBottom);
                yBottom += 5;
            }
            if (societe.bic) {
                doc.text(`BIC : ${societe.bic}`, template.marginLeft, yBottom);
                yBottom += 5;
            }
        }

        // LEGAL FOOTER
        if (template.showFooter) {
            const yFooter = PAGE_HEIGHT - template.marginBottom;
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);

            const parts = [
                `${societe.nom.toUpperCase()} ${societe.formeJuridique || ""}`,
                societe.capitalSocial ? `Capital: ${societe.capitalSocial}` : "",
                societe.adresse ? societe.adresse.replace(/\n/g, ', ') : "",
                societe.siret ? `SIRET: ${societe.siret}` : "",
                societe.rcs ? `RCS: ${societe.rcs}` : "",
                societe.tvaIntra ? `TVA: ${societe.tvaIntra}` : ""
            ].filter(Boolean);

            const legalLine = parts.join(' - ');
            doc.text(legalLine, PAGE_WIDTH / 2, yFooter, { align: "center" });
        }

        // ==========================================
        // OUTPUT
        // ==========================================
        if (options?.returnBlob) {
            return doc.output('bloburl');
        }
        if (options?.returnBase64) {
            // Return base64 string without data prefix if needed, or with it.
            // Nodemailer often likes buffer or base64 string.
            // doc.output('datauristring') returns "data:application/pdf;filename=generated.pdf;base64,....."
            // We can strip the prefix later or here.
            const dataUri = doc.output('datauristring');
            return dataUri.split(',')[1]; // Just the base64 part
        }

        doc.save(`${documentTitle}_${documentNumber}.pdf`);

    } catch (error) {
        console.error("PDF generation error", error);
        // Alert removed to avoid intrusive notifications
    }
};
