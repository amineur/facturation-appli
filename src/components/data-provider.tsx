"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dataService } from "@/lib/data-service";
import { fetchClients, fetchProducts, fetchInvoices, fetchQuotes, fetchSocietes, createSociete as createSocieteAction, updateSociete as updateSocieteAction, getSociete, updateOverdueInvoices, fetchUserById, markHistoryAsRead } from "@/app/actions";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { Societe, Facture, Client, Produit, Devis, User } from "@/types";
import { usePathname, useRouter } from "next/navigation";

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
    refreshData: (silent?: boolean) => Promise<void>;
    isLoading: boolean;
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
    history: any[];
    logAction: (action: 'create' | 'update' | 'delete' | 'read' | 'other', entityType: 'facture' | 'devis' | 'client' | 'produit' | 'societe' | 'settings', description: string, entityId?: string) => void;
    confirm: (options: ConfirmOptions) => void;
    markHistoryAsRead: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [clients, setClients] = useState<Client[]>([]);
    const [products, setProducts] = useState<Produit[]>([]);
    const [invoices, setInvoices] = useState<Facture[]>([]);
    const [quotes, setQuotes] = useState<Devis[]>([]);
    const [societe, setSociete] = useState<Societe | null>(null);
    const [societes, setSocietes] = useState<Societe[]>([]);
    const [user, setUser] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async (silent: boolean = false) => {
        if (process.env.NODE_ENV !== "production") console.time("TotalLoadTime");
        if (!silent) setIsLoading(true);

        const userId = typeof window !== 'undefined' ? localStorage.getItem("glassy_current_user_id") : null;

        // 1. Parallelize Initial Independent Fetches
        // We catch errors individually to avoid one failure blocking the whole app
        const [overdueRes, userResResult, societesRes] = await Promise.all([
            updateOverdueInvoices().catch(e => { console.error("Overdue error", e); return null; }),
            userId ? fetchUserById(userId).catch(e => { console.error("User fetch error", e); return { success: false, data: null }; }) : Promise.resolve(null),
            fetchSocietes().catch(e => { console.error("Societes fetch error", e); return { success: false, data: [] }; })
        ]);

        // 2. Process User
        let finalUser = null;
        if (userId) {
            let processedUserRes = userResResult;

            // Auto-create/restore strategy if not found
            if (!processedUserRes || !processedUserRes.success || !processedUserRes.data) {
                console.log("User not found in DB, attempting auto-creation/restoration...");
                const defaultUser = {
                    id: userId,
                    email: "amine@urbanhit.fr",
                    fullName: "Amine Ben Abla",
                    role: "admin",
                    societes: []
                };
                const createRes = await import("@/app/actions").then(m => m.upsertUser(defaultUser));
                if (createRes.success && createRes.user) {
                    processedUserRes = { success: true, data: createRes.user };
                }
            }

            if (processedUserRes && processedUserRes.success && processedUserRes.data) {
                finalUser = processedUserRes.data;
                setUser(finalUser);

                // Update LocalStorage cache
                const users = dataService.getUsers();
                const index = users.findIndex(u => u.id === userId);
                if (index >= 0) {
                    users[index] = finalUser;
                } else {
                    users.push(finalUser);
                }
                if (typeof window !== 'undefined') {
                    localStorage.setItem("glassy_users", JSON.stringify(users));
                }
            } else {
                // Fallback
                finalUser = dataService.getCurrentUser();
                setUser(finalUser);
            }
        } else {
            finalUser = dataService.getCurrentUser();
            setUser(finalUser);
        }

        // 3. Process Societes & Entity Data
        let validSocietes: Societe[] = [];
        let activeSociete: Societe | undefined;

        if (societesRes && societesRes.success && societesRes.data && societesRes.data.length > 0) {
            validSocietes = societesRes.data as Societe[];
            setSocietes(validSocietes);

            let storedId = dataService.getActiveSocieteId();
            activeSociete = validSocietes.find(s => s.id === storedId);

            if (!activeSociete) {
                activeSociete = validSocietes[0];
                dataService.switchSociete(activeSociete.id);
            }
        } else {
            console.warn("No societies found in Database.");
            setSocietes([]);
            setSociete(null);
        }

        if (activeSociete) {
            setSociete(activeSociete);
            const currentSocieteId = activeSociete.id;

            // Parallelize Entity Fetches (already done, but keeping structure)
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

        if (!silent) setIsLoading(false);
        if (process.env.NODE_ENV !== "production") console.timeEnd("TotalLoadTime");

        // Lazy load history (15 items) to not block UI
        const historyData = await dataService.getHistory(15);
        setHistory(historyData);
    };

    useEffect(() => {
        dataService.initialize();

        const currentUser = dataService.getCurrentUser();
        if (!currentUser && pathname !== "/login") {
            const userId = localStorage.getItem("glassy_current_user_id");
            if (!userId) {
                router.push("/login");
                setIsLoading(false);
                return;
            }
        }

        fetchData();
    }, [pathname]);

    const [isDirty, setIsDirty] = useState(false);

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

    const handleRefresh = async (silent: boolean = false) => {
        await fetchData(silent);
    };

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
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
            fetchData();
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
            fetchData();
        } else {
            console.error(res.error);
        }
        setIsLoading(false);
        return res;
    };

    // Cron Ticker for Scheduled Emails
    const handleMarkHistoryRead = async () => {
        const currentUser = user || dataService.getCurrentUser();
        if (currentUser && currentUser.id) {
            await markHistoryAsRead(currentUser.id);
            // Optimistically update local user state
            const updatedUser = { ...currentUser, lastReadHistory: new Date().toISOString() };
            setUser(updatedUser);
            // Also update local storage cache if needed
            const users = dataService.getUsers();
            const idx = users.findIndex(u => u.id === currentUser.id);
            if (idx >= 0) {
                users[idx] = updatedUser;
                localStorage.setItem("glassy_users", JSON.stringify(users));
            }
        }
    };

    useEffect(() => {
        const checkScheduled = async () => {
            try {
                await fetch('/api/cron/process-scheduled-emails');
            } catch (e) {
                // Silent fail
            }
        };
        checkScheduled();
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
                    await fetchData(true);
                } else {
                    console.error("[DataProvider] Action NOT logged: No user identified");
                }
            },
            confirm,
            markHistoryAsRead: handleMarkHistoryRead
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
