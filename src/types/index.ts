export type StatusFacture = 'Brouillon' | 'Envoyée' | 'Payée' | 'Retard' | 'Annulée' | 'Archivée';
export type StatusDevis = 'Brouillon' | 'Envoyé' | 'Accepté' | 'Refusé' | 'Facturé' | 'Converti' | 'Archivé';
export type InvoiceStatus = StatusFacture; // Backward compatibility alias if needed
export type InvoiceType = 'Facture' | 'Devis';

export interface LigneItem {
    id: string;
    description: string;
    quantite: number;
    prixUnitaire: number;
    tva: number; // Pourcentage, ex: 20
    remise?: number; // Pourcentage ou Montant fixe ? Pour l'instant pourcentage
    remiseType?: 'pourcentage' | 'montant'; // Add missing field
    produitId?: string; // Add missing field
    type?: string; // Add missing field
    totalLigne: number; // Calculé
}

export interface Produit {
    id: string;
    nom: string;
    description?: string;
    prixUnitaire: number;
    tva: number;
    societeId: string;
}

export interface Client {
    id: string;
    societeId: string; // Lien vers l'émetteur
    nom: string;
    reference?: string; // Add missing field
    email: string;
    adresse: string;
    adresse2?: string; // Add missing field
    codePostal: string;
    ville: string;
    pays?: string; // Add missing field
    telephone?: string;
    mobile?: string; // Add missing field
    siren?: string;
    siret?: string; // Alias for siren
    tvaIntracom?: string; // Standard
    tvaIntra?: string; // Alias found in mock

    // Contact infos
    titreContact?: string; // Add missing field
    prenomContact?: string;
    nomContact?: string;

    // Legal infos
    rcs?: string;
}

export interface Societe {
    id: string;
    nom: string;
    email: string | null;
    telephone: string | null;
    adresse: string | null;
    codePostal: string | null;
    ville: string | null;
    pays: string | null;
    siret: string | null;
    tvaIntra: string | null;
    logoUrl: string | null;
    iban: string | null;
    bic: string | null;
    titulaireCompte: string | null;
    mentionsLegales: string | null;
    cgv: string | null;

    // Branding
    primaryColor: string | null;
    secondaryColor: string | null;

    // Settings
    defaultTva: number;
    defaultConditions: string | null;
    currency: string;
    invoicePrefix: string | null;
    quotePrefix: string | null;

    // Legal
    capitalSocial: string | null;
    formeJuridique: string | null;
    rcs: string | null;
    siteWeb: string | null;
    banque: string | null;

    // SMTP
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPass: string | null;
    smtpSecure: boolean;
    smtpFrom: string | null;

    createdAt?: string;
    updatedAt?: string;
}

export interface User {
    id: string;
    email: string;
    fullName: string;
    password?: string; // Encrypted or mock
    role: 'admin' | 'user' | 'viewer';
    permissions: string[]; // e.g. 'create:invoice', 'delete:client'
    societes: string[]; // IDs of permitted societes
    currentSocieteId?: string; // Last active society
    lastReadHistory?: string; // ISO Date of last check
    avatarUrl?: string | null;
}

export interface HistoryEntry {
    id: string;
    userId: string;
    userName: string;
    action: 'create' | 'update' | 'delete' | 'read' | 'other';
    entityType: 'facture' | 'devis' | 'client' | 'produit' | 'societe' | 'settings';
    entityId?: string;
    description: string; // "A créé une nouvelle facture F-2024-001"
    timestamp: string; // ISO date
    details?: any; // Snapshot of changes if needed
}

export interface EmailLog {
    id: string;
    documentId: string;
    date: string; // ISO
    actionType: 'envoi' | 'relance' | 'download'; // Type d'action
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    message: string;
    status: 'sent' | 'failed' | 'draft' | 'scheduled';
    attachments: { name: string; size?: number; type: string; content?: string }[];
    relatedEmailId?: string; // ID de l'email d'origine pour les relances
    scheduledAt?: string; // ISO date pour envoi différé
}

export interface Acompte {
    date: string; // ISO date
    montant: number;
    moyenPaiement: string;
    reference?: string;
}

export interface Facture {
    id: string;
    numero: string; // Ex: FACT-2024-001
    type: InvoiceType;
    dateEmission: string; // ISO Date
    echeance: string; // ISO Date
    statut: StatusFacture;
    datePaiement?: string; // Add missing field
    isLocked?: boolean;

    // Config snapshot
    config?: {
        showDateColumn?: boolean;
        showTTCColumn?: boolean;
        discountEnabled?: boolean;
        discountType?: 'pourcentage' | 'montant';
        defaultTva?: number;
        showOptionalFields?: boolean;
    };

    // Relations
    clientId: string;
    societeId: string;

    // External relations
    devisLieId?: string;

    // Contenu
    items: LigneItem[];

    // Totaux (calculés mais stockés pour perf/historique)
    totalHT: number;
    totalTTC: number;
    itemsJSON?: string;
    totalTVA?: number;

    remiseGlobale?: number; // Valeur
    remiseGlobaleType?: 'pourcentage' | 'montant';

    acomptes?: Acompte[];
    totalAcomptes?: number;
    resteAPayer?: number;

    // Note spécifique à cette facture
    notes?: string;
    conditions?: string;

    // Snapshot des infos client/sté au moment de la création (immuabilité)
    clientSnapshot?: Partial<Client>;
    societeSnapshot?: Partial<Societe>;

    // Soft delete
    isDeleted?: boolean;
    deletedAt?: string;
    archivedAt?: string;

    createdAt?: string;
    updatedAt?: string;


    emails?: EmailLog[]; // History of sent emails
}

export interface Devis extends Omit<Facture, 'type' | 'statut' | 'echeance'> {
    type: 'Devis';
    statut: StatusDevis;
    dateValidite: string; // ISO Date
    emails?: EmailLog[]; // History of sent emails
    isLocked?: boolean;
}

// Configuration globale app
export interface GlobalConfig {
    nextInvoiceNumber: number;
    invoicePrefix: string; // "FACT-"
    nextQuoteNumber: number;
    quotePrefix: string; // "DEV-"
    defaultTVA: number; // 20
}

// --- PDF TEMPLATE SYSTEM ---

export interface PdfLabels {
    factureTitle: string;
    devisTitle: string;
    dateEmission: string;
    dateEcheance: string;
    dateValidite: string;
    client: string;
    description: string;
    quantite: string;
    prixUnitaire: string;
    totalHT: string;
    tva: string;
    totalTTC: string;
    remise: string;
    montant: string; // Total Ligne "Montant"
    paymentInfo: string;
}

export interface PdfTemplate {
    // Layout
    layoutMode: 'classic' | 'modern' | 'minimalist';
    headerStyle: 'standard' | 'centered' | 'banner';

    // Margins (mm)
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;

    // Logo
    logoSize: number; // width in mm

    // Typography
    fontFamily: 'helvetica' | 'times' | 'courier';
    titleSize: number; // pt
    bodySize: number; // pt

    // Colors (Hex)
    primaryColor: string;   // Headers, totals
    secondaryColor: string; // Subtitles, lines
    accentColor: string;    // Highlights
    textColor: string;      // Body text

    // Table Style
    tableStyle: 'plain' | 'striped' | 'grid';
    tableHeaderBg: string;
    tableHeaderColor: string;
    tableBorderColor: string;
    tableBorders: boolean;

    // Content Visibility
    showSiretTop: boolean;
    showPaymentInfo: boolean;
    showLegalNotice: boolean;
    showFooter: boolean;

    // Table Columns Visibility
    showQuantite: boolean;
    showTva: boolean;
    showRemise: boolean;
    showTtc?: boolean; // Added optional to avoid breaking existing objects immediately, or non-optional if I update default
    showDate: boolean; // Date column in lines?

    // Custom Labels
    labels: PdfLabels;
}

export const DEFAULT_PDF_TEMPLATE: PdfTemplate = {
    layoutMode: 'modern',
    headerStyle: 'standard',
    marginTop: 20,
    marginBottom: 40, // Space for footer
    marginLeft: 15,
    marginRight: 15,
    logoSize: 40,
    fontFamily: 'helvetica',
    titleSize: 20,
    bodySize: 10,
    primaryColor: '#000000',
    secondaryColor: '#666666',
    accentColor: '#000000',
    textColor: '#333333',
    tableStyle: 'plain',
    tableHeaderBg: '#f0f0f0',
    tableHeaderColor: '#000000',
    tableBorderColor: '#e5e7eb',
    tableBorders: true,
    showSiretTop: true,
    showPaymentInfo: true,
    showLegalNotice: true,
    showFooter: true,
    showQuantite: true,
    showTva: true,
    showRemise: false,
    showTtc: true,
    showDate: false,
    labels: {
        factureTitle: 'FACTURE',
        devisTitle: 'DEVIS',
        dateEmission: 'Date',
        dateEcheance: 'Échéance',
        dateValidite: 'Validité',
        client: 'Facturer à',
        description: 'Description',
        quantite: 'Qté',
        prixUnitaire: 'Prix Unit.',
        totalHT: 'Total HT',
        tva: 'TVA',
        totalTTC: 'Total TTC',
        remise: 'Remise',
        montant: 'Montant',
        paymentInfo: 'Informations de paiement'
    }
};

// --- PRO TEMPLATE SYSTEM (MINI-CANVA) ---

export type BlockType = 'text' | 'image' | 'table' | 'shape' | 'line';

export interface BlockStyle {
    color?: string;
    backgroundColor?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
    textAlign?: 'left' | 'center' | 'right';
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    opacity?: number;
    zIndex?: number;
    padding?: number;
    underline?: boolean;
}

export interface TemplateBlock {
    id: string;
    type: BlockType;
    x: number; // mm
    y: number; // mm
    width: number; // mm
    height: number; // mm
    content: string | any; // Json content or raw text
    style: BlockStyle;
    isLocked?: boolean;
}

export interface PageSettings {
    format: 'a4' | 'letter';
    orientation: 'portrait' | 'landscape';
    margins: { top: number; bottom: number; left: number; right: number };
    gridSize: number;
    showGrid: boolean;
    snapToGrid: boolean;
}

export interface ProTemplate {
    id: string;
    name: string;
    blocks: TemplateBlock[];
    pageSettings: PageSettings;
    created_at: string;
    updated_at: string;
}
