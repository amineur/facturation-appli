import { Client, Facture, Devis, Produit, Societe, User, PdfTemplate, DEFAULT_PDF_TEMPLATE, StatusFacture } from "@/types";
import { MOCK_CLIENTS, MOCK_FACTURES, MOCK_PRODUITS, MOCK_DEVIS, MOCK_SOCIETES, MOCK_USERS } from "./mock-data";
import { generateNextInvoiceNumber } from "@/lib/invoice-utils";

const STORAGE_KEYS = {
    CLIENTS: "glassy_clients",
    PRODUCTS: "glassy_products",
    INVOICES: "glassy_invoices",
    QUOTES: "glassy_quotes",
    SOCIETES: "glassy_societes", // Renamed/New
    ACTIVE_SOCIETE_ID: "glassy_active_societe_id", // New
    USERS: "glassy_users", // New
    CURRENT_USER_ID: "glassy_current_user_id", // New
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
}

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
    defaultTva: 20,
    showDateColumn: false,
    showTTCColumn: false,
    discountEnabled: false,
    discountType: 'pourcentage',
    showOptionalFields: false
};

class DataService {
    // -- Initialization --
    initialize() {
        if (typeof window === 'undefined') return;

        if (!localStorage.getItem(STORAGE_KEYS.CLIENTS)) {
            localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(MOCK_CLIENTS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(MOCK_PRODUITS));
        }
        if (!localStorage.getItem(STORAGE_KEYS.INVOICES)) {
            localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(MOCK_FACTURES));
        }
        if (!localStorage.getItem(STORAGE_KEYS.QUOTES)) {
            localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(MOCK_DEVIS));
        }
        // Initialize Societes List
        if (!localStorage.getItem(STORAGE_KEYS.SOCIETES)) {
            localStorage.setItem(STORAGE_KEYS.SOCIETES, JSON.stringify(MOCK_SOCIETES));
        }
        // Initialize Users
        // Initialize Users
        if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(MOCK_USERS));
        }
        // Set Default Active Societe if not set
        if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID)) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, "soc_1");
        }
        // Set Default Current User if not set (Mock Login)
        if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, "usr_1");
        }

        this.cleanupTemporaryData();
    }

    // Explicitly remove the "bad" data added during valid/invalid attempts
    private cleanupTemporaryData() {
        if (typeof window === 'undefined') return;

        try {
            // 1. Clean Invoices
            const rawInvoices = localStorage.getItem(STORAGE_KEYS.INVOICES);
            if (rawInvoices) {
                const invoices = JSON.parse(rawInvoices);
                const garbageIds = ["fac_2", "fac_3", "fac_4"];

                // Filter out garbage
                let cleanInvoices = invoices.filter((i: any) => !garbageIds.includes(i.id));

                // Force-reset existing fac_1 to original mock state (2023)
                // Data auto-injection disabled - user will import fresh data
                // No automatic restoration of mock data
            }

            // 2. Clean Quotes (Devis) - assuming similar issues might exist or just to be safe
            const rawQuotes = localStorage.getItem(STORAGE_KEYS.QUOTES);
            if (rawQuotes) {
                const quotes = JSON.parse(rawQuotes);
                // If there are other created devis we want to kill, filter them here.

                if (JSON.stringify(quotes) !== rawQuotes) {
                    console.log("Deep cleaning quotes...");
                    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
                }
            }

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
        if (typeof window === 'undefined') return MOCK_USERS[0];
        const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
        const users = this.getItem<User>(STORAGE_KEYS.USERS);
        return users.find(u => u.id === userId) || users[0];
    }

    getUsers(): User[] {
        return this.getItem<User>(STORAGE_KEYS.USERS);
    }

    saveUser(user: User) {
        const users = this.getUsers();
        const index = users.findIndex(u => u.id === user.id);
        if (index >= 0) {
            users[index] = user;
        } else {
            users.push(user);
        }
        this.setItem(STORAGE_KEYS.USERS, users);
    }

    // -- Societe --
    getActiveSocieteId(): string {
        if (typeof window === 'undefined') return "soc_1";
        return localStorage.getItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID) || "soc_1";
    }

    switchSociete(id: string) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SOCIETE_ID, id);
        // Also update current user's last active societe
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            currentUser.currentSocieteId = id;
            this.saveUser(currentUser);
        }
        window.location.reload(); // Simple reload to refresh all data context
    }

    getSocietes(): Societe[] {
        return this.getItem<Societe>(STORAGE_KEYS.SOCIETES);
    }

    getSociete(): Societe {
        const id = this.getActiveSocieteId();
        const societes = this.getSocietes();
        return societes.find(s => s.id === id) || societes[0];
    }

    updateSociete(societe: Societe) {
        if (!societe.id) return;
        const societes = this.getSocietes();
        const index = societes.findIndex(s => s.id === societe.id);
        if (index >= 0) {
            societes[index] = societe;
            this.setItem(STORAGE_KEYS.SOCIETES, societes);
        }
    }

    createSociete(nom: string): Societe {
        const newSociete: Societe = {
            id: `soc_${crypto.randomUUID()}`,
            nom: nom,
            email: "",
            adresse: "",
            codePostal: "",
            ville: "",
            telephone: "",
            siret: "",
            tvaIntracom: ""
        };
        const societes = this.getSocietes();
        societes.push(newSociete);
        this.setItem(STORAGE_KEYS.SOCIETES, societes);

        // Also add access to this company for the current user
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            currentUser.societes.push(newSociete.id);
            this.saveUser(currentUser);
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

        // Helper: Title Case for Addresses & Cities
        const toTitleCase = (str: string) => {
            if (!str) return "";
            return str.toLowerCase().replace(/(?:^|\s|-)\S/g, function (a) { return a.toUpperCase(); });
        };

        const COUNTRY_MAPPING: Record<string, string> = {
            "FR": "France",
            "BE": "Belgique",
            "CH": "Suisse",
            "CA": "Canada",
            "SE": "Suède",
            "US": "États-Unis",
            "DE": "Allemagne",
            "ES": "Espagne",
            "IT": "Italie",
            "GB": "Royaume-Uni",
            "UK": "Royaume-Uni",
            "LU": "Luxembourg"
        };

        // Migration & Standardization
        return clients.map(c => {
            let pays = c.pays;
            // 1. Country Migration
            if (pays && COUNTRY_MAPPING[pays.toUpperCase()]) {
                pays = COUNTRY_MAPPING[pays.toUpperCase()];
            }

            // 2. Address & City Standardization
            let adresse = c.adresse ? toTitleCase(c.adresse) : c.adresse;
            let ville = c.ville ? toTitleCase(c.ville) : c.ville;
            let adresse2 = c.adresse2 ? toTitleCase(c.adresse2) : c.adresse2;

            return { ...c, pays, adresse, ville, adresse2 };
        });
    }

    getClient(id: string): Client | undefined {
        // Note: We search in ALL clients for safety, but UI should only show permitted ones
        // Actually, for correctness, let's just find in filtered list
        return this.getClients().find(c => c.id === id);
    }

    saveClient(client: Client) {
        if (!client.societeId) client.societeId = this.getActiveSocieteId();

        const clients = this.getItem<Client>(STORAGE_KEYS.CLIENTS); // Get raw list
        const index = clients.findIndex(c => c.id === client.id);
        if (index >= 0) {
            clients[index] = client;
        } else {
            clients.push(client);
        }
        this.setItem(STORAGE_KEYS.CLIENTS, clients);
    }

    deleteClient(id: string) {
        const clients = this.getItem<Client>(STORAGE_KEYS.CLIENTS).filter(c => c.id !== id);
        this.setItem(STORAGE_KEYS.CLIENTS, clients);
    }

    // -- Products --
    getProducts(): Produit[] {
        const activeSocieteId = this.getActiveSocieteId();
        return this.getItem<Produit>(STORAGE_KEYS.PRODUCTS).filter(p => p.societeId === activeSocieteId);
    }

    saveProduct(product: Produit) {
        if (!product.societeId) product.societeId = this.getActiveSocieteId();

        const products = this.getItem<Produit>(STORAGE_KEYS.PRODUCTS);
        const index = products.findIndex(p => p.id === product.id);
        if (index >= 0) {
            products[index] = product;
        } else {
            products.push(product);
        }
        this.setItem(STORAGE_KEYS.PRODUCTS, products);
    }

    deleteProduct(id: string) {
        const products = this.getItem<Produit>(STORAGE_KEYS.PRODUCTS).filter(p => p.id !== id);
        this.setItem(STORAGE_KEYS.PRODUCTS, products);
    }

    // -- Invoices --
    getInvoices(): Facture[] {
        const activeSocieteId = this.getActiveSocieteId();
        const invoices = this.getItem<Facture>(STORAGE_KEYS.INVOICES)
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
        return this.getItem<Facture>(STORAGE_KEYS.INVOICES).filter(i => i.societeId === activeSocieteId);
    }

    getDeletedInvoices(): Facture[] {
        const activeSocieteId = this.getActiveSocieteId();
        return this.getItem<Facture>(STORAGE_KEYS.INVOICES)
            .filter(i => i.societeId === activeSocieteId)
            .filter(i => i.isDeleted);
    }

    getInvoice(id: string): Facture | undefined {
        return this.getAllInvoices().find(i => i.id === id); // Use getAll to allow finding even if deleted or status logic
    }

    saveInvoice(invoice: Facture) {
        if (!invoice.societeId) invoice.societeId = this.getActiveSocieteId();

        const invoices = this.getItem<Facture>(STORAGE_KEYS.INVOICES);
        const index = invoices.findIndex(i => i.id === invoice.id);
        if (index >= 0) {
            invoices[index] = invoice;
        } else {
            // New invoice
            if (!invoice.id || invoice.id === 'temp') {
                invoice.id = crypto.randomUUID();
            }
            invoices.push(invoice);
        }
        this.setItem(STORAGE_KEYS.INVOICES, invoices);
        return invoice;
    }

    deleteInvoice(id: string) {
        const invoices = this.getItem<Facture>(STORAGE_KEYS.INVOICES);
        const invoice = invoices.find(i => i.id === id);
        if (invoice) {
            invoice.isDeleted = true;
            invoice.deletedAt = new Date().toISOString();
            this.setItem(STORAGE_KEYS.INVOICES, invoices);
        }
    }

    restoreInvoice(id: string) {
        const invoices = this.getItem<Facture>(STORAGE_KEYS.INVOICES);
        const invoice = invoices.find(i => i.id === id);
        if (invoice) {
            invoice.isDeleted = false;
            invoice.deletedAt = undefined;
            this.setItem(STORAGE_KEYS.INVOICES, invoices);
        }
    }

    permanentlyDeleteInvoice(id: string) {
        const invoices = this.getItem<Facture>(STORAGE_KEYS.INVOICES).filter(i => i.id !== id);
        this.setItem(STORAGE_KEYS.INVOICES, invoices);
    }

    deleteAllInvoices() {
        // Only delete for current society
        const activeSocieteId = this.getActiveSocieteId();
        const allInvoices = this.getItem<Facture>(STORAGE_KEYS.INVOICES);
        const keptInvoices = allInvoices.filter(i => i.societeId !== activeSocieteId);
        this.setItem(STORAGE_KEYS.INVOICES, keptInvoices);
    }

    // -- Quotes (Devis) --
    private getAllQuotesInternal(): Devis[] {
        const activeSocieteId = this.getActiveSocieteId();
        const quotes = this.getItem<Devis>(STORAGE_KEYS.QUOTES).filter(q => q.societeId === activeSocieteId);

        // Migration on the fly: Converti -> Facturé
        return quotes.map(q => {
            // Ensure type is set for legacy data
            const quoteWithType = { ...q, type: "Devis" as const };

            // @ts-ignore - handling legacy data
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

        const quotes = this.getItem<Devis>(STORAGE_KEYS.QUOTES);
        const index = quotes.findIndex(q => q.id === quote.id);
        if (index >= 0) {
            quotes[index] = quote;
        } else {
            // New quote
            if (!quote.id || quote.id === 'temp') {
                quote.id = crypto.randomUUID();
            }
            quotes.push(quote);
        }
        this.setItem(STORAGE_KEYS.QUOTES, quotes);
        return quote;
    }

    deleteQuote(id: string) {
        const quotes = this.getItem<Devis>(STORAGE_KEYS.QUOTES);
        const quote = quotes.find(q => q.id === id);
        if (quote) {
            quote.isDeleted = true;
            quote.deletedAt = new Date().toISOString();
            this.setItem(STORAGE_KEYS.QUOTES, quotes);
        }
    }

    restoreQuote(id: string) {
        const quotes = this.getItem<Devis>(STORAGE_KEYS.QUOTES);
        const quote = quotes.find(q => q.id === id);
        if (quote) {
            quote.isDeleted = false;
            quote.deletedAt = undefined;
            this.setItem(STORAGE_KEYS.QUOTES, quotes);
        }
    }

    permanentlyDeleteQuote(id: string) {
        const quotes = this.getItem<Devis>(STORAGE_KEYS.QUOTES).filter(q => q.id !== id);
        this.setItem(STORAGE_KEYS.QUOTES, quotes);
    }

    // -- Advanced --
    convertQuoteToInvoice(quoteId: string): Facture | null {
        const quote = this.getQuote(quoteId);
        if (!quote) return null;

        // Update quote status
        quote.statut = "Facturé";
        this.saveQuote(quote);

        // Get consistent next invoice number
        const existingInvoices = this.getInvoices();
        const nextNumber = generateNextInvoiceNumber(existingInvoices);

        // Create new invoice
        const newInvoice: Facture = {
            id: crypto.randomUUID(),
            numero: nextNumber,
            type: "Facture",
            devisLieId: quote.id,
            dateEmission: new Date().toISOString().split('T')[0],
            echeance: "", // To be filled by user ideally, or default +30d
            statut: "Brouillon",
            clientId: quote.clientId,
            societeId: quote.societeId,
            items: quote.items,
            totalHT: quote.totalHT,
            totalTTC: quote.totalTTC
        };

        return this.saveInvoice(newInvoice);
    }
}

export const dataService = new DataService();
