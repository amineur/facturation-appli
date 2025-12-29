import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Facture, Devis, Societe, Client } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";



export const generateInvoicePDF = (
    document: Facture | Devis,
    societe: Societe,
    client: Client,
    options?: {
        returnBlob?: boolean;
        returnBase64?: boolean;
    }
) => {
    try {
        // Input validation
        if (!document || !societe || !client) {
            console.error("[PDF] Missing required data:", { document: !!document, societe: !!societe, client: !!client });
            throw new Error("Données manquantes pour générer le PDF");
        }
        if (!document.numero) {
            console.error("[PDF] Missing document number");
            throw new Error("Numéro de document manquant");
        }
        // Ensure config is an object
        if (document.config && typeof document.config === 'string') {
            try {
                document.config = JSON.parse(document.config);
            } catch {
                document.config = {};
            }
        }
        if (!document.config || typeof document.config !== 'object') {
            document.config = {};
        }

        // --- HARDCODED REFERENCE STYLE ---
        // User requested to "Reproduce the layout", implying strict adherence to the new design.
        // We override the style vars to match the clean "White/Black/Gray" look.
        const FONT = "helvetica";
        const COLOR_PRIMARY: [number, number, number] = [0, 0, 0]; // Black
        const COLOR_SECONDARY: [number, number, number] = [80, 80, 80]; // Dark Gray
        const COLOR_ACCENT: [number, number, number] = [240, 240, 240]; // Light Gray for Table Header

        const doc = new jsPDF({ unit: "mm", format: "a4" });
        const PAGE_WIDTH = 210;
        const PAGE_HEIGHT = 297;
        const MARGIN_LEFT = 20; // "Marges confortables"
        const MARGIN_RIGHT = 20;
        const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

        const isFacture = "type" in document ? document.type === "Facture" : (document as any).type !== "Devis";
        const documentTitle = isFacture ? "FACTURE" : "DEVIS";
        const documentNumber = document.numero;

        // Formatted Dates
        let dateEmission = "";
        let dateEcheance = "";
        if (document.dateEmission) {
            dateEmission = format(new Date(document.dateEmission), "dd/MM/yyyy", { locale: fr });
        }
        if (isFacture && 'echeance' in document && document.echeance) {
            dateEcheance = format(new Date(document.echeance), "dd/MM/yyyy", { locale: fr });
        } else if (!isFacture && 'dateValidite' in document && document.dateValidite) {
            dateEcheance = format(new Date(document.dateValidite), "dd/MM/yyyy", { locale: fr });
        }

        const y = 20; // Start Y

        // ==========================================
        // 1. HEADER
        // ==========================================

        // --- LOGO (Left) ---
        let yLogoBottom = y;
        if (societe.logoUrl) {
            try {
                const maxW = 50;
                const maxH = 25;
                const props = doc.getImageProperties(societe.logoUrl);
                const ratio = props.width / props.height;
                let logoW = maxW;
                let logoH = logoW / ratio;
                if (logoH > maxH) {
                    logoH = maxH;
                    logoW = logoH * ratio;
                }
                doc.addImage(societe.logoUrl, 'JPEG', MARGIN_LEFT, y, logoW, logoH);
                yLogoBottom = y + logoH;
            } catch (e) {
                // Fallback handled in Emitter text
            }
        }

        // --- TITLE BLOCK (Right) ---
        // Aligned to Right margin
        let yHeaderRight = y + 5;
        doc.setFontSize(12); // Reduced from 16 for homogeneity
        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text(`${documentTitle} - ${documentNumber}`, PAGE_WIDTH - MARGIN_RIGHT, yHeaderRight, { align: "right" });

        yHeaderRight += 6; // Reduced spacing
        doc.setFontSize(9); // Reduced from 10 to match body
        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);

        doc.text(`Date de facturation: ${dateEmission}`, PAGE_WIDTH - MARGIN_RIGHT, yHeaderRight, { align: "right" });
        yHeaderRight += 4;
        if (dateEcheance) {
            const label = isFacture ? "Échéance" : "Validité";
            doc.text(`${label}: ${dateEcheance}`, PAGE_WIDTH - MARGIN_RIGHT, yHeaderRight, { align: "right" });
            yHeaderRight += 4;
        }
        doc.text("Type d'opération: Prestation de services", PAGE_WIDTH - MARGIN_RIGHT, yHeaderRight, { align: "right" });
        yHeaderRight += 4;

        // --- ADDRESSES BLOCK (Emitter & Client) ---
        // Requirement 1: "Alignement strict sur une même ligne"
        // Both start below the lowest of Logo or Title

        const yAddresses = Math.max(yLogoBottom, yHeaderRight) + 10;
        let yEmitter = yAddresses;
        let yClient = yAddresses;

        // -- COLONNE GAUCHE: EMITTER --
        doc.setFontSize(10); // Reduced from 11
        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text(societe.nom, MARGIN_LEFT, yEmitter);
        yEmitter += 5; // Reduced spacing

        doc.setFontSize(8); // Reduced from 9
        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);

        const emitterLines = [
            societe.adresse,
            `${societe.codePostal || ""} ${societe.ville || ""}`.trim(),
            societe.pays || "France",
            societe.telephone ? `Tél : ${societe.telephone}` : null,
            societe.email ? `Email : ${societe.email}` : null,
            societe.siteWeb ? `Web : ${societe.siteWeb}` : null
        ].filter(Boolean);

        emitterLines.forEach(line => {
            if (line) {
                doc.text(line!, MARGIN_LEFT, yEmitter);
                yEmitter += 3.5; // Tighter
            }
        });

        // -- COLONNE DROITE: CLIENT --
        const xClient = 110;

        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text((client.nom || "").toUpperCase(), xClient, yClient);
        yClient += 5;

        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);
        const clientAddr = [
            client.adresse,
            `${client.codePostal || ""} ${client.ville || ""}`.trim(),
            client.pays
        ].filter(Boolean);

        clientAddr.forEach(line => {
            if (line) {
                doc.text(line!, xClient, yClient);
                yClient += 3.5;
            }
        });

        // ==========================================
        // 3. TABLE
        // ==========================================
        const yTable = Math.max(yEmitter, yClient) + 20;

        // Columns Order from Editor:
        // Description | Date? | Quantité | Prix unitaire | Total HT | TVA | Total TTC? | Remise?

        const showRemiseColumn = document.config?.discountEnabled || false;
        const showDateColumn = document.config?.showDateColumn || false;
        const showTTCColumn = document.config?.showTTCColumn || false;

        const columns = [
            { header: "Description", dataKey: "description" },
            ...(showDateColumn ? [{ header: "Date", dataKey: "date" }] : []),
            { header: "Quantité", dataKey: "quantite" },
            { header: "Prix unitaire", dataKey: "prixUnitaire" },
            { header: "Total HT", dataKey: "totalHT" },
            { header: "TVA", dataKey: "tva" },
            ...(showTTCColumn ? [{ header: "Total TTC", dataKey: "totalTTC" }] : []),
            ...(showRemiseColumn ? [{ header: "Remise", dataKey: "remise" }] : []),
        ];

        const tableBody = (Array.isArray(document.items) ? document.items : []).map(item => {
            const pu = typeof item.prixUnitaire === 'number' ? item.prixUnitaire : 0;
            const qty = typeof item.quantite === 'number' ? item.quantite : 1;
            const tva = typeof item.tva === 'number' ? item.tva : 0;
            const remiseVal = item.remise || 0;

            // Calc HT (Net de remise ligne)
            let montantHT = pu * qty;
            if (remiseVal > 0) montantHT = montantHT * (1 - (remiseVal / 100));

            // Calc TTC
            const montantTTC = montantHT * (1 + (tva / 100));

            const cleanDesc = (item.description || "").replace(/<[^>]*>?/gm, '');

            const rowData: any = {
                description: cleanDesc,
                quantite: qty.toFixed(2).replace('.', ','),
                prixUnitaire: `${pu.toFixed(2).replace('.', ',')} €`,
                totalHT: `${montantHT.toFixed(2).replace('.', ',')} €`,
                tva: `${tva.toFixed(2).replace('.', ',')} %`,
                totalTTC: `${montantTTC.toFixed(2).replace('.', ',')} €`
            };

            if (showDateColumn && item.date) {
                try {
                    rowData.date = format(new Date(item.date), "dd/MM/yyyy", { locale: fr });
                } catch (e) {
                    rowData.date = "";
                }
            } else if (showDateColumn) {
                rowData.date = "";
            }

            if (showRemiseColumn) {
                rowData.remise = `${remiseVal} %`;
            }

            return rowData;
        });

        // DYNAMIC WIDTH CALCULATION (Strict 170mm Total)
        // Optimization for tightness to allowing Desc to coexist with 8 columns.

        // Fixed:
        const wQty = 20;  // Increased to prevent "Quantit-é" wrapping
        const wPU = 22;   // Reduced from 28
        const wHT = 22;   // Reduced from 21 (Total HT)
        const wTVA = 16;  // Reduced from 20
        // Sum Fixed = 20+22+22+16 = 80mm

        // Optional:
        const wDate = showDateColumn ? 20 : 0;
        const wTTC = showTTCColumn ? 22 : 0;
        const wRemise = showRemiseColumn ? 15 : 0;

        const wUsed = 76 + wDate + wTTC + wRemise;
        const widthDescription = 170 - wUsed;

        const colStyles: any = {
            description: { cellWidth: widthDescription, halign: 'left' },
            quantite: { cellWidth: wQty },
            prixUnitaire: { cellWidth: wPU },
            totalHT: { cellWidth: wHT },
            tva: { cellWidth: wTVA }
        };

        if (showDateColumn) colStyles.date = { cellWidth: wDate, halign: 'left' };
        if (showTTCColumn) colStyles.totalTTC = { cellWidth: wTTC };
        if (showRemiseColumn) colStyles.remise = { cellWidth: wRemise };

        const LINE_WIDTH = 0.1;
        const LINE_COLOR: [number, number, number] = [0, 0, 0];

        autoTable(doc, {
            startY: yTable,
            columns: columns,
            body: tableBody,
            theme: 'plain',
            margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
            styles: {
                font: FONT,
                fontSize: 8, // Refined small
                cellPadding: 2, // Tighter
                textColor: [0, 0, 0],
                lineWidth: 0,
                valign: 'middle'
            },
            headStyles: {
                fillColor: [255, 255, 255],
                textColor: [0, 0, 0],
                fontStyle: 'bold',
                fontSize: 9, // Slightly header
                lineWidth: 0,
            },
            columnStyles: colStyles,
            didParseCell: (data) => {
                const key = data.column.dataKey;
                const isHeader = data.section === 'head';

                if (key === 'description') {
                    data.cell.styles.halign = 'left';
                }
                else if (key === 'quantite' || key === 'tva' || key === 'prixUnitaire' || key === 'totalHT' || key === 'totalTTC' || key === 'remise') {
                    // STRICT RIGHT ALIGNMENT (No Wrapping)
                    data.cell.styles.halign = 'right';
                }
            },
            didDrawCell: (data) => {
                const doc = data.doc;
                const { cell, row, table } = data;

                doc.setDrawColor(...LINE_COLOR);
                doc.setLineWidth(LINE_WIDTH);

                // 2. En-tête : Trait au-dessus et en-dessous
                if (data.section === 'head') {
                    // Top line
                    doc.line(cell.x, cell.y, cell.x + cell.width, cell.y);
                    // Bottom line
                    doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
                }

                // 4. Séparation tableau / totaux : Trait après la dernière ligne
                if (data.section === 'body' && row.index === table.body.length - 1) {
                    doc.line(cell.x, cell.y + cell.height, cell.x + cell.width, cell.y + cell.height);
                }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // ==========================================
        // 4. BOTTOM BLOCKS
        // ==========================================

        // --- TOTALS (Right) ---
        // --- TOTALS (Right) ---
        let yTotals = finalY;
        const xTotalsLabel = 140;
        const xTotalsValue = PAGE_WIDTH - MARGIN_RIGHT;

        doc.setFontSize(8); // Body font size match
        doc.setTextColor(0, 0, 0);

        // Calculate total line discounts
        let totalLineDiscounts = 0;
        (Array.isArray(document.items) ? document.items : []).forEach(item => {
            const pu = typeof item.prixUnitaire === 'number' ? item.prixUnitaire : 0;
            const qty = typeof item.quantite === 'number' ? item.quantite : 1;
            const remiseVal = item.remise || 0;
            const remiseType = item.remiseType || 'pourcentage';

            const montantBrut = pu * qty;
            let discountAmount = 0;

            if (remiseVal > 0) {
                if (remiseType === 'montant') {
                    discountAmount = remiseVal;
                } else {
                    discountAmount = montantBrut * (remiseVal / 100);
                }
            }

            totalLineDiscounts += discountAmount;
        });

        // HT Brut (if there are discounts)
        if (totalLineDiscounts > 0) {
            const totalHTBrut = document.totalHT + totalLineDiscounts;
            doc.setFont(FONT, "normal");
            doc.text("Total HT brut", xTotalsLabel, yTotals);
            doc.text(`${totalHTBrut.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
            yTotals += 4;

            // Total remises lignes
            doc.text("Total remises", xTotalsLabel, yTotals);
            doc.text(`- ${totalLineDiscounts.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
            yTotals += 4;

            // HT Net
            doc.setFont(FONT, "bold");
            doc.text("Total HT net", xTotalsLabel, yTotals);
            doc.text(`${document.totalHT.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
            yTotals += 4;
        } else {
            // HT (no discounts)
            doc.setFont(FONT, "normal");
            doc.text("Total HT", xTotalsLabel, yTotals);
            doc.text(`${document.totalHT.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
            yTotals += 4;
        }

        // REMISE GLOBALE (if any)
        if (document.remiseGlobale && document.remiseGlobale > 0) {
            doc.setFont(FONT, "normal");
            doc.text(`Dont remise globale`, xTotalsLabel, yTotals);
            const val = document.remiseGlobale;
            // Assumption: totalHT implies net, but here we just show the info "Dont" or subtract if needed.
            // Simplified: Just showing the amount (negative) or value.
            // If type is percent:
            const label = document.remiseGlobaleType === 'pourcentage' ? `${val} %` : `${val} €`;
            doc.text(`- ${label}`, xTotalsValue, yTotals, { align: "right" });
            yTotals += 4;
        }

        // TVA
        const tvaAmount = document.totalTTC - document.totalHT;
        doc.setFont(FONT, "normal");
        doc.text(`TVA ${(tvaAmount / (document.totalHT || 1) * 100).toFixed(2).replace('.', ',')} %`, xTotalsLabel, yTotals);

        doc.setFont(FONT, "normal");
        doc.text(`${tvaAmount.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });
        yTotals += 4;


        // SEPARATOR
        doc.setDrawColor(...LINE_COLOR);
        doc.setLineWidth(LINE_WIDTH);
        doc.line(xTotalsLabel, yTotals + 1, xTotalsValue, yTotals + 1);
        yTotals += 6;

        // TTC
        doc.setFontSize(10); // Slightly larger but refined
        doc.setFont(FONT, "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Total TTC", xTotalsLabel, yTotals);
        doc.text(`${document.totalTTC.toFixed(2).replace('.', ',')} €`, xTotalsValue, yTotals, { align: "right" });

        // --- PAYMENT & CONDITIONS (Left) ---
        // Aligned visually with totals start Y approx, or below. Kept below as per "Layout Strictly Respected"
        let yPayment = finalY; // Reset to start below table
        // Actually earlier code had `yPayment = yTotals + 10`.
        // If "stacked" layout is preferred, we keep it.
        // But commonly, Payment info is on Left. 
        // User rejected "Side by Side". So we stick to "Below".
        yPayment = yTotals + 8;

        doc.setFontSize(8);
        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text("Moyens de paiement :", MARGIN_LEFT, yPayment);
        yPayment += 4;

        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);

        if (societe.banque) {
            doc.text(`Banque: ${societe.banque}`, MARGIN_LEFT, yPayment);
            yPayment += 3.5;
        }
        if (societe.bic) {
            doc.text(`SWIFT/BIC: ${societe.bic}`, MARGIN_LEFT, yPayment);
            yPayment += 3.5;
        }
        if (societe.iban) {
            doc.text(`IBAN: ${societe.iban}`, MARGIN_LEFT, yPayment);
            yPayment += 3.5;
        }

        // --- SPECIFIC NOTES & CONDITIONS ---
        // If they exist, print them below payment info
        if (document.notes || document.conditions) {
            yPayment += 6;

            if (document.notes) {
                doc.setFont(FONT, "bold");
                doc.setTextColor(...COLOR_PRIMARY);
                doc.text("Notes :", MARGIN_LEFT, yPayment);
                yPayment += 4;

                doc.setFont(FONT, "normal");
                doc.setTextColor(...COLOR_SECONDARY);
                const splitNotes = doc.splitTextToSize(document.notes, 80); // Width limited to left column
                doc.text(splitNotes, MARGIN_LEFT, yPayment);
                yPayment += (splitNotes.length * 3.5) + 4;
            }

            if (document.conditions) {
                doc.setFont(FONT, "bold");
                doc.setTextColor(...COLOR_PRIMARY);
                doc.text("Conditions spécifiques :", MARGIN_LEFT, yPayment);
                yPayment += 4;

                doc.setFont(FONT, "normal");
                doc.setTextColor(...COLOR_SECONDARY);
                const splitCond = doc.splitTextToSize(document.conditions, 80);
                doc.text(splitCond, MARGIN_LEFT, yPayment);
            }
        }

        // Restore Font for footer logic if any
        doc.setFont(FONT, "bold");
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text("Conditions de paiement :", MARGIN_LEFT, yPayment);
        yPayment += 4;

        doc.setFont(FONT, "normal");
        doc.setTextColor(...COLOR_SECONDARY);
        doc.text(document.conditions || societe.defaultConditions || "Paiement à réception", MARGIN_LEFT, yPayment);

        // ==========================================
        // 5. FOOTER (Centered) in all pages
        // ==========================================
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            const yFooter = PAGE_HEIGHT - 15;

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);

            // Footer - Forme juridique - Adresse - SIRET - TVA - RCS
            // 3-4 lignes max, centered or left.
            // Requirement: "Forme juridique, Adresse complète, SIRET, Numéro de TVA, RCS"
            // Let's create a single or double line string centered.

            const footerParts = [
                `${societe.nom.toUpperCase()} ${societe.formeJuridique ? "- " + societe.formeJuridique : ""}`,
                societe.adresse,
                `${societe.codePostal || ""} ${societe.ville || ""}`,
                societe.siret ? `SIRET ${societe.siret}` : null,
                societe.tvaIntra ? `TVA ${societe.tvaIntra}` : null,
                societe.rcs ? `RCS ${societe.rcs}` : null
            ].filter(Boolean);

            // Join with bullet or dash
            // If too long, maybe split? "Pied de page discret"
            // Let's try to fit in 2 lines.

            const line1 = footerParts.slice(0, 3).join(" - ");
            const line2 = footerParts.slice(3).join(" - ");

            doc.text(line1, PAGE_WIDTH / 2, yFooter - 3, { align: "center" });
            doc.text(line2, PAGE_WIDTH / 2, yFooter, { align: "center" });

            // Pagination
            doc.text(`${i}/${pageCount}`, PAGE_WIDTH - MARGIN_RIGHT, yFooter + 3, { align: "right" });
        }

        // ==========================================
        // 6. CGV Page (if exists)
        // ==========================================
        if (societe.cgv) {
            doc.addPage();
            const pageCountNew = doc.getNumberOfPages(); // Updates total
            // Re-run footer loop or just add footer to this page? 
            // Better to re-run footer loop at the very end usually, but jspdf structure makes it hard.
            // Actually, we should check CGV at start or just Add footer at the very very end.

            // Text for CGV
            doc.setFontSize(12); // Reduced Layout
            doc.setFont(FONT, "bold");
            doc.setTextColor(...COLOR_PRIMARY);
            doc.text("Conditions Générales de Vente", MARGIN_LEFT, 20);

            doc.setFontSize(7); // "Fine print" size
            doc.setFont(FONT, "normal");
            doc.setTextColor(...COLOR_SECONDARY);

            const splitText = doc.splitTextToSize(societe.cgv, CONTENT_WIDTH);
            doc.text(splitText, MARGIN_LEFT, 30);

            // Add Footer to this new page (and update previous pages totals?)
            // Just handling local footer for this page, ignoring "2/2" update complexity for now unless we iterate again.
            const yFooter = PAGE_HEIGHT - 15;
            doc.setFontSize(7); // Matches Footer
            doc.setTextColor(100, 100, 100);
            const line1 = `${societe.nom.toUpperCase()} ${societe.formeJuridique ? "- " + societe.formeJuridique : ""}`;
            doc.text(line1, PAGE_WIDTH / 2, yFooter - 3, { align: "center" });
            // ... simplistic footer
            doc.text(`${pageCountNew}/${pageCountNew}`, PAGE_WIDTH - MARGIN_RIGHT, yFooter + 3, { align: "right" });
            // Note: page numbers on previous pages currently say "1/1". 
            // Ideally we define footer function and call it on all pages at end.
        }

        // ==========================================
        // 7. WATERMARK (If Cancelled)
        // ==========================================
        if (document.statut === "Annulée") {
            const pageCountFinal = doc.getNumberOfPages();
            for (let p = 1; p <= pageCountFinal; p++) {
                doc.setPage(p);
                const centerX = PAGE_WIDTH / 2;
                const centerY = PAGE_HEIGHT / 2;
                doc.saveGraphicsState();
                doc.setTextColor(230, 80, 80);
                doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
                doc.setFontSize(60);
                doc.setFont(FONT, "bold");
                doc.text("FACTURE ANNULÉE", centerX, centerY, { align: 'center', angle: 45 });
                doc.restoreGraphicsState();
            }
        }

        // ==========================================
        // OUTPUT
        // ==========================================
        if (options?.returnBlob) {
            return doc.output('bloburl');
        }
        if (options?.returnBase64) {
            const dataUri = doc.output('datauristring');
            return dataUri.split(',')[1];
        }

        doc.save(`${documentTitle}_${documentNumber}.pdf`);

    } catch (error) {
        console.error("PDF generation error", error);
    }
};
