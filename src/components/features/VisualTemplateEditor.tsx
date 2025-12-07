import React from 'react';
import { PdfTemplate, Societe, Client, Facture, LigneItem } from '@/types';
import { cn } from '@/lib/utils';
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface VisualTemplateEditorProps {
    template: PdfTemplate;
    onChange: (template: PdfTemplate) => void;
    societe: Societe;
    client: Client;
    document: Facture;
}

export const VisualTemplateEditor: React.FC<VisualTemplateEditorProps> = ({
    template,
    onChange,
    societe,
    client,
    document
}) => {
    // Helper to update specific label
    const updateLabel = (key: keyof PdfTemplate['labels'], value: string) => {
        onChange({
            ...template,
            labels: {
                ...template.labels,
                [key]: value
            }
        });
    };

    const mmToPx = (mm: number) => mm * 3.78; // Approx conversion for screen display

    // Text Styles
    const titleStyle = {
        fontFamily: template.fontFamily,
        fontSize: `${template.titleSize}pt`,
        color: template.primaryColor,
        fontWeight: 'bold',
        lineHeight: 1.2
    };

    const bodyStyle = {
        fontFamily: template.fontFamily,
        fontSize: `${template.bodySize}pt`,
        color: template.textColor,
        lineHeight: 1.5
    };

    const secondaryStyle = {
        fontFamily: template.fontFamily,
        fontSize: `${template.bodySize}pt`,
        color: template.secondaryColor,
    };

    // Date formatting
    const dateEmission = document.dateEmission ? format(new Date(document.dateEmission), "dd.MM.yy", { locale: fr }) : "";
    const dateEcheance = document.echeance ? format(new Date(document.echeance), "dd.MM.yy", { locale: fr }) : "";

    return (
        <div
            className="bg-white mx-auto shadow-2xl transition-all duration-300 origin-top"
            style={{
                width: '210mm',
                minHeight: '297mm',
                paddingTop: `${template.marginTop}mm`,
                paddingBottom: `${template.marginBottom}mm`,
                paddingLeft: `${template.marginLeft}mm`,
                paddingRight: `${template.marginRight}mm`,
                boxSizing: 'border-box',
                position: 'relative'
            }}
        >
            {/* 1. HEADER */}
            {template.showSiretTop && (
                <div
                    className={cn(
                        "text-[8pt] text-gray-400 mb-4 absolute top-2",
                        template.headerStyle === 'centered' ? "left-0 right-0 text-center" : "left-[20mm]"
                    )}
                    style={{ top: `${template.marginTop / 2}mm`, left: template.headerStyle === 'centered' ? 0 : `${template.marginLeft}mm` }}
                >
                    SIRET: {societe?.siret || '000 000 000 00000'}
                </div>
            )}

            <div className={cn(
                "flex mb-12",
                template.headerStyle === 'centered' ? "flex-col items-center text-center space-y-6" : "justify-between items-start"
            )}>
                {/* Logo / Company Name */}
                <div className={cn("flex flex-col", template.headerStyle === 'centered' && "items-center")}>
                    {societe?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={societe.logoUrl}
                            alt="Logo"
                            style={{ width: `${template.logoSize}mm`, maxHeight: '25mm', objectFit: 'contain' }}
                        />
                    ) : (
                        <h1 style={{ ...titleStyle, fontSize: `${template.titleSize * 1.2}pt` }}>{(societe?.nom || 'Votre Société').toUpperCase()}</h1>
                    )}

                    {template.headerStyle !== 'centered' && !societe.logoUrl && (
                        <div style={{ ...secondaryStyle, marginTop: 4 }}></div>
                    )}
                </div>

                {/* Document Title & Number */}
                <div className={cn("flex flex-col", template.headerStyle === 'centered' ? "items-center" : "items-end text-right")}>
                    <div className="flex items-center gap-2 group relative">
                        <input
                            value={template.labels.factureTitle}
                            onChange={(e) => updateLabel('factureTitle', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 focus:bg-blue-50 focus:border-blue-500 outline-none transition-colors w-auto text-right uppercase"
                            style={{ ...titleStyle, textAlign: template.headerStyle === 'centered' ? 'center' : 'right' }}
                        />
                        <span style={titleStyle}>{document.numero}</span>
                    </div>

                    <div className="mt-2 text-sm text-gray-500 flex flex-col gap-1 w-full" style={{ alignItems: template.headerStyle === 'centered' ? 'center' : 'flex-end' }}>
                        <div className="flex items-center gap-2">
                            <input
                                value={template.labels.dateEmission}
                                onChange={(e) => updateLabel('dateEmission', e.target.value)}
                                className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 outline-none text-right w-32"
                                style={secondaryStyle}
                            />
                            <span style={bodyStyle}>{dateEmission}</span>
                        </div>
                        {document.echeance && (
                            <div className="flex items-center gap-2">
                                <input
                                    value={template.labels.dateEcheance}
                                    onChange={(e) => updateLabel('dateEcheance', e.target.value)}
                                    className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 outline-none text-right w-32"
                                    style={secondaryStyle}
                                />
                                <span style={bodyStyle}>{dateEcheance}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. ADDRESSES */}
            <div className="grid grid-cols-2 gap-12 mb-16 px-2">
                {/* Emitter */}
                <div style={bodyStyle}>
                    <div style={{ ...titleStyle, fontSize: `${template.bodySize}pt`, marginBottom: '8px' }}>{societe.nom}</div>
                    {societe.mentionLegale && (
                        <p className="text-[10px] text-muted-foreground mt-4">
                            {societe.mentionLegale}
                        </p>
                    )}
                    <div className="whitespace-pre-line text-gray-600">
                        {societe.adresse}
                        <br />
                        {societe.codePostal} {societe.ville}
                        <br />
                        {societe.emailContact}
                    </div>
                </div>

                {/* Client */}
                <div className="bg-gray-50/50 p-4 rounded-lg border border-gray-100/50" style={bodyStyle}>
                    <div className="flex items-center gap-2 mb-2">
                        <input
                            value={template.labels.client}
                            onChange={(e) => updateLabel('client', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 outline-none text-sm font-medium text-gray-400 uppercase tracking-wider w-20"
                        />
                    </div>
                    <div style={{ ...titleStyle, fontSize: `${template.bodySize}pt`, marginBottom: '4px' }}>{client.nom}</div>
                    <div className="whitespace-pre-line text-gray-600">
                        {client.adresse}
                        <br />
                        {client.codePostal} {client.ville}
                    </div>
                </div>
            </div>

            {/* 3. TABLE */}
            <div className="mb-12">
                <div
                    className="grid gap-4 py-3 px-4 mb-2 border-b"
                    style={{
                        backgroundColor: template.tableStyle === 'plain' ? 'transparent' : template.tableHeaderBg,
                        borderColor: template.tableBorderColor,
                        borderTopWidth: template.tableBorders || template.tableStyle === 'grid' ? 1 : 0,
                        borderBottomWidth: template.tableBorders || template.tableStyle === 'grid' || template.tableStyle === 'plain' ? 2 : 0,
                        borderLeftWidth: template.tableBorders || template.tableStyle === 'grid' ? 1 : 0,
                        borderRightWidth: template.tableBorders || template.tableStyle === 'grid' ? 1 : 0,
                        gridTemplateColumns: `3fr ${template.showDate ? '1fr' : ''} ${template.showQuantite ? '0.8fr' : ''} 1fr ${template.showTva ? '0.8fr' : ''} ${template.showRemise ? '0.8fr' : ''} 1fr`
                    }}
                >
                    <input
                        value={template.labels.description}
                        onChange={(e) => updateLabel('description', e.target.value)}
                        className="bg-transparent font-bold border-b border-transparent hover:border-blue-400 hover:bg-white/20 outline-none w-full"
                        style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}
                    />
                    {template.showDate && (
                        <span className="font-bold text-center" style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}>Date</span>
                    )}
                    {template.showQuantite && (
                        <input
                            value={template.labels.quantite}
                            onChange={(e) => updateLabel('quantite', e.target.value)}
                            className="bg-transparent font-bold border-b border-transparent hover:border-blue-400 hover:bg-white/20 outline-none w-full text-center"
                            style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}
                        />
                    )}
                    <input
                        value={template.labels.prixUnitaire}
                        onChange={(e) => updateLabel('prixUnitaire', e.target.value)}
                        className="bg-transparent font-bold border-b border-transparent hover:border-blue-400 hover:bg-white/20 outline-none w-full text-right"
                        style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}
                    />
                    {template.showTva && (
                        <input
                            value={template.labels.tva}
                            onChange={(e) => updateLabel('tva', e.target.value)}
                            className="bg-transparent font-bold border-b border-transparent hover:border-blue-400 hover:bg-white/20 outline-none w-full text-right"
                            style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}
                        />
                    )}
                    {template.showRemise && (
                        <input
                            value={template.labels.remise}
                            onChange={(e) => updateLabel('remise', e.target.value)}
                            className="bg-transparent font-bold border-b border-transparent hover:border-blue-400 hover:bg-white/20 outline-none w-full text-center"
                            style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}
                        />
                    )}
                    <input
                        value={template.labels.montant}
                        onChange={(e) => updateLabel('montant', e.target.value)}
                        className="bg-transparent font-bold border-b border-transparent hover:border-blue-400 hover:bg-white/20 outline-none w-full text-right"
                        style={{ color: template.tableStyle === 'plain' ? template.primaryColor : template.tableHeaderColor }}
                    />
                </div>

                <div className="space-y-1">
                    {document.items.map((item, idx) => (
                        <div
                            key={item.id}
                            className="grid gap-4 py-3 px-4 border-b border-gray-100"
                            style={{
                                backgroundColor: template.tableStyle === 'striped' && idx % 2 === 1 ? '#F9FAFB' : 'transparent',
                                borderColor: template.tableBorderColor,
                                borderLeftWidth: template.tableBorders || template.tableStyle === 'grid' ? 1 : 0,
                                borderRightWidth: template.tableBorders || template.tableStyle === 'grid' ? 1 : 0,
                                borderBottomWidth: template.tableBorders || template.tableStyle === 'grid' ? 1 : 1,
                                gridTemplateColumns: `3fr ${template.showDate ? '1fr' : ''} ${template.showQuantite ? '0.8fr' : ''} 1fr ${template.showTva ? '0.8fr' : ''} ${template.showRemise ? '0.8fr' : ''} 1fr`
                            }}
                        >
                            <div className="text-gray-800 font-medium" style={bodyStyle}>{item.description}</div>
                            {template.showDate && <div className="text-center text-gray-500" style={bodyStyle}>-</div>}
                            {template.showQuantite && <div className="text-center text-gray-600" style={bodyStyle}>{item.quantite}</div>}
                            <div className="text-right text-gray-600" style={bodyStyle}>{item.prixUnitaire.toFixed(2)} €</div>
                            {template.showTva && <div className="text-right text-gray-500" style={bodyStyle}>{item.tva}%</div>}
                            {template.showRemise && <div className="text-center text-gray-500" style={bodyStyle}>-</div>}
                            <div className="text-right font-medium text-gray-900" style={bodyStyle}>{(item.quantite * item.prixUnitaire).toFixed(2)} €</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. TOTALS */}
            <div className="flex justify-end mb-20 pr-4">
                <div className="w-1/3 min-w-[250px] space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <input
                            value={template.labels.totalHT}
                            onChange={(e) => updateLabel('totalHT', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 outline-none text-right w-full mr-4"
                            style={secondaryStyle}
                        />
                        <span style={bodyStyle} className="font-medium text-gray-900">{document.totalHT.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                        <input
                            value={template.labels.tva}
                            onChange={(e) => updateLabel('tva', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 outline-none text-right w-full mr-4"
                            style={secondaryStyle}
                        />
                        <span style={bodyStyle} className="font-medium text-gray-900">{(document.totalTTC - document.totalHT).toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <input
                            value={template.labels.totalTTC}
                            onChange={(e) => updateLabel('totalTTC', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-50 outline-none text-right w-full mr-4 font-bold"
                            style={{ ...titleStyle, fontSize: `${template.bodySize + 4}pt` }}
                        />
                        <span style={{ ...titleStyle, fontSize: `${template.bodySize + 4}pt` }}>{document.totalTTC.toFixed(2)} €</span>
                    </div>
                </div>
            </div>

            {/* 5. FOOTER & PAYMENT */}
            <div className="absolute bottom-12 left-0 right-0 px-[20mm]">
                {template.showPaymentInfo && (
                    <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <input
                            value={template.labels.paymentInfo}
                            onChange={(e) => updateLabel('paymentInfo', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-blue-400 hover:bg-blue-100 outline-none mb-2 font-bold w-full"
                            style={{ ...titleStyle, fontSize: template.bodySize }}
                        />
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600" style={bodyStyle}>
                            <div>Banque: <span className="font-medium text-gray-900">{societe.banque || "N/A"}</span></div>
                            <div>IBAN: <span className="font-medium text-gray-900 font-mono">{societe.iban || "N/A"}</span></div>
                            <div>Titulaire: <span className="font-medium text-gray-900">{societe.titulaireCompte || societe.nom}</span></div>
                            <div>BIC: <span className="font-medium text-gray-900 font-mono">{societe.bic || "N/A"}</span></div>
                        </div>
                    </div>
                )}

                {template.showFooter && (
                    <div className="text-center border-t pt-4 text-gray-400" style={{ fontSize: '8pt', fontFamily: template.fontFamily }}>
                        {societe.nom} - SIRET {societe.siret} - {societe.ville}
                        <br />
                        {societe.mentionLegale || "TVA non applicable, art. 293 B du CGI"}
                    </div>
                )}
            </div>

            {/* HOVER HINT */}
            <div className="absolute inset-0 pointer-events-none border-2 border-transparent group-hover:border-blue-500/20 transition-all rounded-lg" />
        </div>
    );
};
