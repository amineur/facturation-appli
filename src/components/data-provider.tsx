"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dataService } from "@/lib/data-service";
import { fetchClients, fetchProducts, fetchInvoices, fetchQuotes, fetchSocietes, createSociete as createSocieteAction, updateSociete as updateSocieteAction, getSociete, updateOverdueInvoices, fetchUserById } from "@/app/actions";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Societe, Facture, Client, Produit, Devis, User } from "@/types";
import { usePathname, useRouter } from "next/navigation"; // Added imports

export interface ConfirmOptions {
    title: string;
    message: string;
    onConfirm: () => void;
}

interface DataContextType {
    clients: Client[];
    products: Produit[];
    invoices: Facture[];
    quotes: Devis[];
    societe: Societe | null;
    societes: Societe[];
    user: any;
    switchSociete: (id: string) => void;
    createSociete: (nom: string) => Promise<any>;
    updateSociete: (societe: Societe) => Promise<any>;
    refreshData: () => void;
    isLoading: boolean;
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
    history: any[]; // Avoid circular dep for now or import HistoryEntry
    logAction: (action: 'create' | 'update' | 'delete' | 'read' | 'other', entityType: 'facture' | 'devis' | 'client' | 'produit' | 'societe' | 'settings', description: string, entityId?: string) => void;
    confirm: (options: ConfirmOptions) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const router = useRouter(); // Added router
    const pathname = usePathname(); // Added pathname
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Produit[]>([]);
    const [invoices, setInvoices] = useState<Facture[]>([]);
    const [quotes, setQuotes] = useState<Devis[]>([]);
    const [societe, setSociete] = useState<Societe | null>(null);
    const [societes, setSocietes] = useState<Societe[]>([]);
    const [user, setUser] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [version, setVersion] = useState(0); // Trigger re-fetches

    useEffect(() => {
        dataService.initialize();

        // Auth Check
        const currentUser = dataService.getCurrentUser();
        // If no user found AND we are not arguably on the login page (or public page if any)
        if (!currentUser && pathname !== "/login") {
            // Check if we really have no user (DataService might return default mock if not logged out properly, but login() clears it?)
            // Actually getCurrentUser returns MOCK[0] if not set in some cases? 
            // In data-service.ts: getCurrentUser() checks localStorage. if undefined returns MOCK_USERS[0]. 
            // We need to fix getCurrentUser to return NULL if no ID is set.
            // But let's assume valid ID means valid session for now.
            // If we want strict auth, we should check logic in DataService.

            // Re-checking DataService logic: 
            // const userId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
            // return users.find(...) || users[0]; -> It falls back to users[0]!
            // This defeats the protection. 
            // I need to fix DataService.getCurrentUser() first or handle it here by checking RAW storage?
            // BETTER: Use dataService.isLoggedIn() helper if it existed.
            // I will check Raw Storage here for safety or rely on the fix I will apply to DataService next.

            const userId = localStorage.getItem("glassy_current_user_id"); // Hardcoded key check
            if (!userId) {
                router.push("/login");
                setIsLoading(false);
                return;
            }
        }

        refreshData();
        setIsLoading(false);
    }, [pathname]); // Re-run on path change to protect routes? Or just mount? 
    // Usually mount + check. pathname dep might cause loops if not careful.
    // Effect should be safe as long as we push only if condition met.

    const refreshData = async () => {
        setIsLoading(true);

        // Fetch local data for Societe and non-Airtable items
        // setSociete(dataService.getSociete()); 
        // setSocietes(dataService.getSocietes());

        // 0. Update Overdue Invoices
        await updateOverdueInvoices();

        // Load User: Sync from DB to ensure fresh data
        const userId = typeof window !== 'undefined' ? localStorage.getItem("glassy_current_user_id") : null;
        if (userId) {
            const userRes = await fetchUserById(userId);
            if (userRes.success && userRes.data) {
                setUser(userRes.data);
                // Update localStorage cache
                const users = dataService.getUsers();
                const index = users.findIndex(u => u.id === userId);
                if (index >= 0) {
                    users[index] = userRes.data;
                    if (typeof window !== 'undefined') {
                        localStorage.setItem("glassy_users", JSON.stringify(users));
                    }
                }
            } else {
                // Fallback to localStorage if DB fetch fails
                const currentUser = dataService.getCurrentUser();
                setUser(currentUser);
            }
        } else {
            const currentUser = dataService.getCurrentUser();
            setUser(currentUser);
        }

        // 1. Fetch real societes from DB first
        const societesRes = await fetchSocietes();
        let validSocietes: Societe[] = [];
        let activeSociete: Societe | undefined;

        if (societesRes.success && societesRes.data && societesRes.data.length > 0) {
            validSocietes = societesRes.data as Societe[];
            setSocietes(validSocietes);

            // 2. Get active ID from LocalStorage (Source of Truth for SELECTION, not DATA)
            let storedId = dataService.getActiveSocieteId();

            // 3. Find it in the REAL list
            activeSociete = validSocietes.find(s => s.id === storedId);

            if (!activeSociete) {
                // If ID invalid or not found in DB, default to first valid one
                activeSociete = validSocietes[0];
                dataService.switchSociete(activeSociete.id); // Update LS
            }
        } else {
            // DB Empty - No fallback to local storage
            console.warn("No societies found in Database.");
            setSocietes([]);
            setSociete(null);
        }

        if (activeSociete) {
            setSociete(activeSociete);
            const currentSocieteId = activeSociete.id;

            // Fetch everything else based on this validated ID
            const [clientsRes, productsRes, invoicesRes, quotesRes] = await Promise.all([
                fetchClients(currentSocieteId),
                fetchProducts(currentSocieteId),
                fetchInvoices(currentSocieteId),
                fetchQuotes(currentSocieteId)
            ]);

            if (clientsRes.success && clientsRes.data) setClients(clientsRes.data);
            if (productsRes.success && productsRes.data) setProducts(productsRes.data);
            if (invoicesRes.success && invoicesRes.data) setInvoices(invoicesRes.data);
            if (quotesRes.success && quotesRes.data) setQuotes(quotesRes.data);
        }

        setIsLoading(false);
    };

    // Listen for version changes if we want to force updates from outside
    useEffect(() => {
        refreshData();
    }, [version]);

    const [isDirty, setIsDirty] = useState(false);

    // Generic Confirmation State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: "",
        message: "",
        onConfirm: () => { }
    });

    const confirm = (options: ConfirmOptions) => {
        setConfirmState({
            isOpen: true,
            title: options.title,
            message: options.message,
            onConfirm: () => {
                options.onConfirm();
                setConfirmState(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleRefresh = () => {
        setVersion(v => v + 1);
    };

    // Protect against closing window with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = ''; // Modern browsers require this
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleSwitchSociete = async (societeId: string) => {
        if (isDirty) {
            confirm({
                title: "Modifications non enregistrées",
                message: "Des modifications non enregistrées seront perdues si vous changez de société. Voulez-vous continuer ?",
                onConfirm: () => {
                    setIsDirty(false);
                    dataService.switchSociete(societeId);
                    handleRefresh();
                }
            });
            return;
        }
        dataService.switchSociete(societeId);
        handleRefresh();
    };

    const handleCreateSociete = async (nom: string) => {
        setIsLoading(true);
        const res = await createSocieteAction(nom);
        if (res.success && res.data) {
            const newId = (res.data as any).id;
            dataService.switchSociete(newId);
            refreshData();
            router.push("/settings");
            setIsLoading(false);
            return res.data;
        } else {
            console.error(res.error);
            setIsLoading(false);
            return null;
        }
    };

    const handleUpdateSociete = async (data: Societe) => {
        setIsLoading(true);
        const res = await updateSocieteAction(data);
        if (res.success) {
            refreshData();
        } else {
            console.error(res.error);
        }
        setIsLoading(false);
        return res;
    };

    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        dataService.getHistory(300).then(data => setHistory(data));
    }, [version]);

    // Cron Ticker for Scheduled Emails
    useEffect(() => {
        const checkScheduled = async () => {
            try {
                await fetch('/api/cron/process-scheduled-emails');
            } catch (e) {
                // Silent fail to not annoy user in console if offline
            }
        };
        // Check immediately on mount
        checkScheduled();
        // Check every 60 seconds
        const interval = setInterval(checkScheduled, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <DataContext.Provider value={{
            clients,
            products,
            invoices,
            quotes,
            societe,
            societes,
            user,
            switchSociete: handleSwitchSociete,
            refreshData: handleRefresh,
            createSociete: handleCreateSociete,
            updateSociete: handleUpdateSociete,
            isLoading,
            isDirty,
            setIsDirty,
            history,
            logAction: async (action: any, entityType: any, description: string, entityId?: string) => {
                const currentUser = user || dataService.getCurrentUser();
                console.log(`[DataProvider] logAction called: ${action} ${entityType} - User:`, currentUser);
                if (currentUser) {
                    await dataService.logAction(currentUser, action, entityType, description, entityId);
                    // Force refresh to ensure HistoryDropdown updates
                    setVersion(v => v + 1);
                } else {
                    console.error("[DataProvider] Action NOT logged: No user identified");
                }
            },
            confirm
        }}>
            {children}
            <ConfirmationModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmState.onConfirm}
                title={confirmState.title}
                message={confirmState.message}
            />
        </DataContext.Provider>
    );
}

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error("useData must be used within a DataProvider");
    }
    return context;
};
