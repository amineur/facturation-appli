import { Client, Facture, Devis, Produit, Societe, User, PdfTemplate, DEFAULT_PDF_TEMPLATE, StatusFacture, HistoryEntry } from "@/types";
import { MOCK_CLIENTS, MOCK_FACTURES, MOCK_PRODUITS, MOCK_DEVIS, MOCK_SOCIETES, MOCK_USERS } from "./mock-data";
import { generateNextInvoiceNumber } from "@/lib/invoice-utils";
import { loginUser, registerUser, updateUser, upsertUser } from '@/lib/actions/auth';
import { createHistoryEntry, fetchHistory } from '@/lib/actions/history';

const STORAGE_KEYS = {
    CLIENTS: "glassy_clients",
    PRODUITS: "glassy_products",
    FACTURES: "glassy_invoices",
    DEVIS: "glassy_quotes",
    SOCIETES: "glassy_societes",
    ACTIVE_SOCIETE_ID: "glassy_active_societe_id",
    USERS: "glassy_users",
    CURRENT_USER_ID: "glassy_current_user_id",
    HISTORY: "glassy_history",
    GLOBAL_CONFIG: "glassy_global_config",
    PDF_TEMPLATE: "glassy_pdf_template"
};

export interface GlobalConfig {
    defaultTva: number;
    showDateColumn: boolean;
    showTTCColumn: boolean;
    discountEnabled: boolean;
    discountType: 'pourcentage' | 'montant';
    showOptionalFields: boolean;
    // Split defaults
    invoiceDefaults?: {
        showDate: boolean;
        showQuantite: boolean;
        showTva: boolean; // Refers to Column TVA
        showRemise: boolean;
        showTtc: boolean;
    };
    quoteDefaults?: {
        showDate: boolean;
        showQuantite: boolean;
        showTva: boolean;
        showRemise: boolean;
        showTtc: boolean;
    };
    // Operation Type
    operationType?: 'none' | 'service' | 'goods';
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
    defaultTva: 20,
    showDateColumn: false,
    showTTCColumn: false,
    discountEnabled: false,
    discountType: 'pourcentage',
    showOptionalFields: false,
    operationType: 'service', // Default to "Prestation de services"
    invoiceDefaults: {
        showDate: false,
        showQuantite: true,
        showTva: true,
        showRemise: false,
        showTtc: false
    },
    quoteDefaults: {
        showDate: false,
        showQuantite: true,
        showTva: true,
        showRemise: false,
        showTtc: false
    }
};

class DataService {
    // -- Initialization --
    constructor() {
        if (typeof window !== 'undefined') {
            this.initialize();
        }
    }

    initialize() {
        if (typeof window === 'undefined') return;

        // Init default data if empty
        if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
            this.setItem(STORAGE_KEYS.CLIENTS, MOCK_CLIENTS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.PRODUITS)) {
            this.setItem(STORAGE_KEYS.PRODUITS, MOCK_PRODUITS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.FACTURES)) {
            this.setItem(STORAGE_KEYS.FACTURES, MOCK_FACTURES);
        }
        if (!localStorage.getItem(STORAGE_KEYS.DEVIS)) {
            this.setItem(STORAGE_KEYS.DEVIS, MOCK_DEVIS);
        }
        if (!localStorage.getItem(STORAGE_KEYS.SOCIETES)) {
            this.setItem(STORAGE_KEYS.SOCIETES, MOCK_SOCIETES);
        }


        // Set Default Active Societe if not set
        if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID)) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, "Euromedmultimedia");
        } else {
            // Migration: Fix stale IDs from previous version
            const current = localStorage.getItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID);
            if (current === "soc_1") {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, "Euromedmultimedia");
            } else if (current === "soc_2") {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, "Studio Urban");
            }
        }

        // Set Default Current User if not set (Mock Login)
        if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, "usr_1");
        }

        this.cleanupTemporaryData();
    }

    private cleanupTemporaryData() {
        if (typeof window === 'undefined') return;

        try {
            // 1. Clean Invoices
            const rawInvoices = localStorage.getItem(STORAGE_KEYS.FACTURES);
            if (rawInvoices) {
                const invoices = JSON.parse(rawInvoices);
                const garbageIds = ["fac_2", "fac_3", "fac_4"];
                const cleanInvoices = invoices.filter((i: any) => !garbageIds.includes(i.id));

                if (cleanInvoices.length !== invoices.length) {
                    console.log(`Cleaned ${invoices.length - cleanInvoices.length} invalid invoices.`);
                    this.setItem(STORAGE_KEYS.FACTURES, cleanInvoices);
                }
            }

            // 2. Clean Quotes
            // (Similar logic if needed)

        } catch (e) {
            console.error("Cleanup failed", e);
        }
    }

    // -- Helpers --
    private getItem<T>(key: string): T[] {
        if (typeof window === 'undefined') return [];
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : [];
    }

    private setItem<T>(key: string, data: T[]) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, JSON.stringify(data));
    }

    // -- Authentication / User Context --
    getCurrentUser(): User | undefined {
        if (typeof window === 'undefined') return undefined;
        const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
        if (!userId) return undefined;

        const users = this.getItem<User>(STORAGE_KEYS.USERS);
        return users.find(u => u.id === userId);
    }

    getUsers(): User[] {
        return this.getItem<User>(STORAGE_KEYS.USERS);
    }

    async saveUser(user: User) {
        // DB FIRST STRATEGY
        // We defer to the server action to handle "create if new, update if exists"
        const result = await upsertUser(user);

        if (result.success && result.data) {
            // DB Write Success -> Update Local State to match DB
            const savedUser = result.data;

            const users = this.getUsers();
            const index = users.findIndex(u => u.id === savedUser.id);
            if (index >= 0) {
                users[index] = savedUser;
            } else {
                users.push(savedUser);
            }
            this.setItem(STORAGE_KEYS.USERS, users);
            return savedUser;
        } else {
            console.error("Failed to save user to DB:", result.error);
            // OPTIONAL: Throw error or return null to signal failure to UI
            // For now, we do NOT update local state if DB fails, to avoid "illusion" of save.
            throw new Error(result.error || "Erreur de sauvegarde base de données");
        }
    }


    async login(email: string, password?: string): Promise<User | null> {
        if (!password) return null;

        const result = await loginUser(email, password);

        if (result.success && result.data) {
            if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, result.data.id);
                if (result.data.currentSocieteId) {
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, result.data.currentSocieteId);
                }

                // Update local cache
                const users = this.getUsers();
                const index = users.findIndex(u => u.id === result.data.id);
                if (index >= 0) {
                    users[index] = result.data;
                } else {
                    users.push(result.data);
                }
                this.setItem(STORAGE_KEYS.USERS, users);
            }
            return result.data;
        }
        return null;
    }

    async logout() {
        // Call API to remove cookie
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error("Logout API failed", e);
        }

        if (typeof window === 'undefined') return;
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID);
        localStorage.removeItem("glassy_active_societe");

        window.location.href = "/login";
    }

    // -- Societe --
    getActiveSocieteId(): string {
        if (typeof window === 'undefined') return "soc_1";
        return localStorage.getItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID) || "soc_1";
    }

    switchSociete(id: string) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, id);

        const currentUser = this.getCurrentUser();
        if (currentUser) {
            currentUser.currentSocieteId = id;
            this.saveUser(currentUser);
        }
        // window.location.reload(); // REMOVED: Causes User Flash & Cold Start Latency
    }

    getSocietes(): Societe[] {
        return this.getItem<Societe>(STORAGE_KEYS.SOCIETES);
    }

    getSociete(): Societe {
        const id = this.getActiveSocieteId();
        const societes = this.getSocietes();
        return societes.find(s => s.id === id) || societes[0];
    }

    async updateSociete(s: Partial<Societe>) {
        if (!s.id) return;
        // TODO: Server Action
        const societes = this.getSocietes();
        const index = societes.findIndex(soc => soc.id === s.id);
        if (index >= 0) {
            societes[index] = { ...societes[index], ...s };
            this.setItem(STORAGE_KEYS.SOCIETES, societes);
        }
    }

    async createSociete(nom: string): Promise<Societe> {
        // TODO: Server Action for Creation
        const newSociete: Societe = {
            id: `soc_${Date.now()}`,
            nom,
            email: "",
            adresse: "",
            codePostal: "",
            ville: "",
            telephone: "",
            siret: "",
            tvaIntra: "",
            pays: "France",
            logoUrl: null,
            iban: "",
            bic: "",
            titulaireCompte: "",
            mentionsLegales: "",
            cgv: "",
            primaryColor: null,
            secondaryColor: null,
            defaultTva: 20,
            defaultConditions: "",
            currency: "EUR",
            invoicePrefix: "FAC-",
            quotePrefix: "DEV-",
            capitalSocial: "",
            formeJuridique: "",
            rcs: "",
            siteWeb: "",
            banque: "",
            smtpHost: null,
            smtpPort: null,
            smtpUser: null,
            smtpPass: null,
            smtpSecure: false,
            smtpFrom: null
        };

        const societes = this.getSocietes();
        societes.push(newSociete);
        this.setItem(STORAGE_KEYS.SOCIETES, societes);

        // Also add access to this company for the current user
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            // Assuming we also update user's list
            // Update logic might be tricky if not using relation
            // But for now locally:
            // This is messy in local storage mode but fine for transition.

            // In DB mode, the relation handles it.
        }

        return newSociete;
    }

    // -- Global Config --
    getGlobalConfig(): GlobalConfig {
        if (typeof window === 'undefined') return DEFAULT_GLOBAL_CONFIG;
        const item = localStorage.getItem(STORAGE_KEYS.GLOBAL_CONFIG);
        return item ? { ...DEFAULT_GLOBAL_CONFIG, ...JSON.parse(item) } : DEFAULT_GLOBAL_CONFIG;
    }

    saveGlobalConfig(config: GlobalConfig) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.GLOBAL_CONFIG, JSON.stringify(config));
    }

    // -- PDF Template --
    getPdfTemplate(): PdfTemplate {
        if (typeof window === 'undefined') return DEFAULT_PDF_TEMPLATE;
        const item = localStorage.getItem(STORAGE_KEYS.PDF_TEMPLATE);
        return item ? { ...DEFAULT_PDF_TEMPLATE, ...JSON.parse(item) } : DEFAULT_PDF_TEMPLATE;
    }

    savePdfTemplate(template: PdfTemplate) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.PDF_TEMPLATE, JSON.stringify(template));
    }

    // -- Clients --
    getClients(): Client[] {
        const activeSocieteId = this.getActiveSocieteId();
        const clients = this.getItem<Client>(STORAGE_KEYS.CLIENTS).filter(c => c.societeId === activeSocieteId);

        // Helper
        const toTitleCase = (str: string) => {
            if (!str) return "";
            return str.toLowerCase().replace(/(?:^|\s|-)\S/g, function (a) { return a.toUpperCase(); });
        };
        return clients.map(c => {
            return { ...c, adresse: c.adresse ? toTitleCase(c.adresse) : c.adresse, ville: c.ville ? toTitleCase(c.ville) : c.ville };
        });
    }

    getClient(id: string): Client | undefined {
        return this.getClients().find(c => c.id === id);
    }

    saveClient(client: Client) {
        if (!client.societeId) client.societeId = this.getActiveSocieteId();

        const clients = this.getItem<Client>(STORAGE_KEYS.CLIENTS);
        const index = clients.findIndex(c => c.id === client.id);
        if (index >= 0) {
            // clients[index] = client;
        } else {
            // clients.push(client);
        }
        // this.setItem(STORAGE_KEYS.CLIENTS, clients);
    }

    deleteClient(id: string) {
        const clients = this.getItem<Client>(STORAGE_KEYS.CLIENTS).filter(c => c.id !== id);
        this.setItem(STORAGE_KEYS.CLIENTS, clients);
    }

    // -- Products --
    getProducts(): Produit[] {
        const activeSocieteId = this.getActiveSocieteId();
        return this.getItem<Produit>(STORAGE_KEYS.PRODUITS).filter(p => p.societeId === activeSocieteId);
    }

    saveProduct(product: Produit) {
        if (!product.societeId) product.societeId = this.getActiveSocieteId();

        const products = this.getItem<Produit>(STORAGE_KEYS.PRODUITS);
        const index = products.findIndex(p => p.id === product.id);
        if (index >= 0) {
            // products[index] = product;
        } else {
            // products.push(product);
        }
        // this.setItem(STORAGE_KEYS.PRODUITS, products);
    }

    deleteProduct(id: string) {
        const products = this.getItem<Produit>(STORAGE_KEYS.PRODUITS).filter(p => p.id !== id);
        this.setItem(STORAGE_KEYS.PRODUITS, products);
    }

    // -- Invoices --
    getInvoices(): Facture[] {
        const activeSocieteId = this.getActiveSocieteId();
        const invoices = this.getItem<Facture>(STORAGE_KEYS.FACTURES)
            .filter(i => i.societeId === activeSocieteId)
            .filter(i => !i.isDeleted);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return invoices.map(inv => {
            if (inv.statut !== "Payée" && inv.statut !== "Annulée" && inv.statut !== "Retard") {
                if (inv.echeance) {
                    const dueDate = new Date(inv.echeance);
                    if (!isNaN(dueDate.getTime()) && dueDate < today) {
                        return { ...inv, statut: "Retard" };
                    }
                }
            }
            return inv;
        });
    }

    getAllInvoices(): Facture[] {
        const activeSocieteId = this.getActiveSocieteId();
        return this.getItem<Facture>(STORAGE_KEYS.FACTURES).filter(i => i.societeId === activeSocieteId);
    }

    getDeletedInvoices(): Facture[] {
        const activeSocieteId = this.getActiveSocieteId();
        return this.getItem<Facture>(STORAGE_KEYS.FACTURES)
            .filter(i => i.societeId === activeSocieteId)
            .filter(i => i.isDeleted);
    }

    getInvoice(id: string): Facture | undefined {
        return this.getAllInvoices().find(i => i.id === id);
    }

    saveInvoice(invoice: Facture) {
        if (!invoice.societeId) invoice.societeId = this.getActiveSocieteId();

        const invoices = this.getItem<Facture>(STORAGE_KEYS.FACTURES);
        const index = invoices.findIndex(i => i.id === invoice.id);
        if (index >= 0) {
            invoices[index] = invoice;
        } else {
            if (!invoice.id || invoice.id === 'temp') {
                invoice.id = crypto.randomUUID();
            }
            invoices.push(invoice);
        }
        // this.setItem(STORAGE_KEYS.FACTURES, invoices); // Server source of truth now



        return invoice;
    }

    deleteInvoice(id: string) {
        const invoices = this.getItem<Facture>(STORAGE_KEYS.FACTURES);
        const invoice = invoices.find(i => i.id === id);
        if (invoice) {
            invoice.isDeleted = true;
            invoice.deletedAt = new Date().toISOString();
            this.setItem(STORAGE_KEYS.FACTURES, invoices);

        }
    }

    restoreInvoice(id: string) {
        const invoices = this.getItem<Facture>(STORAGE_KEYS.FACTURES);
        const invoice = invoices.find(i => i.id === id);
        if (invoice) {
            invoice.isDeleted = false;
            invoice.deletedAt = undefined;
            this.setItem(STORAGE_KEYS.FACTURES, invoices);

        }
    }

    permanentlyDeleteInvoice(id: string) {
        const invoices = this.getItem<Facture>(STORAGE_KEYS.FACTURES).filter(i => i.id !== id);
        this.setItem(STORAGE_KEYS.FACTURES, invoices);
    }

    deleteAllInvoices() {
        const activeSocieteId = this.getActiveSocieteId();
        const allInvoices = this.getItem<Facture>(STORAGE_KEYS.FACTURES);
        const keptInvoices = allInvoices.filter(i => i.societeId !== activeSocieteId);
        this.setItem(STORAGE_KEYS.FACTURES, keptInvoices);
    }

    // -- Quotes (Devis) --
    private getAllQuotesInternal(): Devis[] {
        const activeSocieteId = this.getActiveSocieteId();
        const quotes = this.getItem<Devis>(STORAGE_KEYS.DEVIS).filter(q => q.societeId === activeSocieteId);

        return quotes.map(q => {
            const quoteWithType = { ...q, type: "Devis" as const };
            // @ts-ignore
            if (quoteWithType.statut === "Converti") {
                return { ...quoteWithType, statut: "Facturé" };
            }
            return quoteWithType;
        });
    }

    getQuotes(): Devis[] {
        return this.getAllQuotesInternal().filter(q => !q.isDeleted);
    }

    getDeletedQuotes(): Devis[] {
        return this.getAllQuotesInternal().filter(q => q.isDeleted);
    }

    getQuote(id: string): Devis | undefined {
        return this.getAllQuotesInternal().find(q => q.id === id);
    }

    saveQuote(quote: Devis) {
        if (!quote.societeId) quote.societeId = this.getActiveSocieteId();

        const quotes = this.getItem<Devis>(STORAGE_KEYS.DEVIS);
        const index = quotes.findIndex(q => q.id === quote.id);
        if (index >= 0) {
            quotes[index] = quote;
        } else {
            if (!quote.id || quote.id === 'temp') {
                quote.id = crypto.randomUUID();
            }
            quotes.push(quote);
        }
        this.setItem(STORAGE_KEYS.DEVIS, quotes);



        return quote;
    }

    deleteQuote(id: string) {
        const quotes = this.getItem<Devis>(STORAGE_KEYS.DEVIS);
        const quote = quotes.find(q => q.id === id);
        if (quote) {
            quote.isDeleted = true;
            quote.deletedAt = new Date().toISOString();
            this.setItem(STORAGE_KEYS.DEVIS, quotes);

        }
    }

    restoreQuote(id: string) {
        const quotes = this.getItem<Devis>(STORAGE_KEYS.DEVIS);
        const quote = quotes.find(q => q.id === id);
        if (quote) {
            quote.isDeleted = false;
            quote.deletedAt = undefined;
            this.setItem(STORAGE_KEYS.DEVIS, quotes);

        }
    }

    permanentlyDeleteQuote(id: string) {
        const quotes = this.getItem<Devis>(STORAGE_KEYS.DEVIS).filter(q => q.id !== id);
        this.setItem(STORAGE_KEYS.DEVIS, quotes);
    }

    convertQuoteToInvoice(quoteId: string): Facture | null {
        const quote = this.getQuote(quoteId);
        if (!quote) return null;

        quote.statut = "Facturé";
        this.saveQuote(quote);

        const existingInvoices = this.getInvoices();
        const nextNumber = generateNextInvoiceNumber(existingInvoices);

        const newInvoice: Facture = {
            id: crypto.randomUUID(),
            numero: nextNumber,
            type: "Facture",
            devisLieId: quote.id,
            dateEmission: new Date().toISOString().split('T')[0],
            echeance: "",
            statut: "Brouillon",
            clientId: quote.clientId,
            societeId: quote.societeId,
            items: quote.items,
            totalHT: quote.totalHT,
            totalTTC: quote.totalTTC
        };

        return this.saveInvoice(newInvoice);
    }

    // -- History / Audit Log --
    async getHistory(limit: number = 50, societeIdOverride?: string): Promise<HistoryEntry[]> {
        const activeSocieteId = societeIdOverride || this.getActiveSocieteId();
        const res = await fetchHistory(limit, activeSocieteId);
        if (res.success && res.data) {
            return res.data as HistoryEntry[];
        }
        return [];
    }

    async logAction(
        user: User,
        action: 'create' | 'update' | 'delete' | 'read' | 'other',
        entityType: 'facture' | 'devis' | 'client' | 'produit' | 'societe' | 'settings',
        description: string,
        entityId?: string
    ) {
        if (typeof window === 'undefined') return;

        // Optimistic UI update (optional, skipping for now to rely on DB)
        // const newEntry: HistoryEntry = { ... };

        // Sanitize Societe ID to avoid Foreign Key errors
        let societeId = user.currentSocieteId || this.getActiveSocieteId();

        // Check if this ID actually exists in our known/valid societies list (local check first to avoid blatant errors)
        // Or if it is "soc_1", remap it.
        if (societeId === "soc_1") societeId = "Euromedmultimedia";
        if (societeId === "soc_2") societeId = "Studio Urban";

        // Fallback: If still not in our DB list (fetched via getSocietes), default to Euromedmultimedia
        // Note: getSocietes() returns what is in local storage which might be separate from DB,
        // but we are trying to align them.

        // Actually best is to just TRY. If it fails, log it.
        // But to fix user issue now:
        const validSocietes = ["Euromedmultimedia", "Studio Urban"];
        if (!validSocietes.includes(societeId) && !societeId.startsWith("soc_")) {
            // If it's some random UUID that might exist, keep it. 
            // But if it's "soc_1" we handled it.
        }

        const res = await createHistoryEntry({
            userId: user.id,
            action,
            entityType,
            description,
            entityId,
            societeId: societeId
        });

        if (!res.success) {
            console.error("Failed to log history (Server Action):", res.error);
            // If error is related to Foreign Key, maybe retry without societeId?
            // "FOREIGN KEY constraint failed"
            if (res.error?.includes("Foreign key constraint failed") || res.error?.includes("constraint")) {
                console.warn("Retrying log without societeId due to constraint error");
                await createHistoryEntry({
                    userId: user.id,
                    action,
                    entityType,
                    description,
                    entityId,
                    societeId: undefined
                });
            }
        }
    }
}

export const dataService = new DataService();
