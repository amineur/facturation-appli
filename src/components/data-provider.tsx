"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { dataService } from "@/lib/data-service";
import { fetchClients, fetchProducts, fetchInvoices, fetchQuotes, fetchSocietes, createSociete as createSocieteAction, updateSociete as updateSocieteAction, getSociete, updateOverdueInvoices, fetchUserById, markHistoryAsRead, fetchAllUsers } from "@/app/actions";
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

    const [authChecked, setAuthChecked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async (silent: boolean = false) => {
        if (process.env.NODE_ENV !== "production") console.time("TotalLoadTime");
        if (!silent) setIsLoading(true);

        const userId = typeof window !== 'undefined' ? localStorage.getItem("glassy_current_user_id") : null;
        const TARGET_EMAIL = "amine@euromedmultimedia.com";

        if (process.env.NODE_ENV === 'development') {
            console.log('[DATA_SCOPE] Starting data fetch, userId from localStorage:', userId);
        }

        // 1. Parallelize Initial Independent Fetches
        // Force simple fetch first to avoid race conditions in logs
        const overdueRes = await updateOverdueInvoices().catch(e => { console.error("Overdue error", e); return null; });
        const societesRes = await fetchSocietes().catch(e => { console.error("Societes fetch error", e); return { success: false, data: [] }; });

        // Explicitly handle user fetch with logs
        let userResResult = null;
        if (userId) {
            if (process.env.NODE_ENV === 'development') console.log(`[AUTH_DEBUG] 🔍 Resolving user with id=${userId} (method: fetchUserById)`);
            userResResult = await fetchUserById(userId).catch(e => { console.error("User fetch error", e); return { success: false, data: null }; });
            if (process.env.NODE_ENV === 'development') console.log(`[AUTH_DEBUG] fetchUserById result:`, userResResult);
        } else {
            if (process.env.NODE_ENV === 'development') console.log(`[AUTH_DEBUG] No userId in localStorage, skipping fetchUserById`);
        }

        // 2. Process User - AUTO-REPAIR: Fix localStorage if needed
        let finalUser = null;

        if (process.env.NODE_ENV === 'development') console.log('[AUTH] Starting user resolution, storageUserId:', userId);

        // Try to load user from DB
        let userResFromStorage = userId ? userResResult : null;

        // If no userId in storage OR user not found in DB → AUTO-REPAIR
        if (!userId || !userResFromStorage || !userResFromStorage.success || !userResFromStorage.data) {
            if (process.env.NODE_ENV === 'development') console.log('[AUTH] User not found or missing, attempting auto-repair...');

            // FALLBACK 1: By Email (Primary recovery)
            if (process.env.NODE_ENV === 'development') console.log(`[AUTH_DEBUG] 🚨 Fallback: attempting to resolve user with email=${TARGET_EMAIL} (method: fetchAllUsers + find)`);
            const allUsersRes = await fetchAllUsers();
            const foundByEmail = allUsersRes.success && allUsersRes.data
                ? allUsersRes.data.find((u: any) => u.email === TARGET_EMAIL)
                : null;

            if (process.env.NODE_ENV === 'development') console.log(`[AUTH_DEBUG] Fallback by email result:`, foundByEmail ? `Found ID: ${foundByEmail.id}` : 'Not Found');

            if (foundByEmail) {
                finalUser = foundByEmail;
                if (process.env.NODE_ENV === 'development') console.log('[AUTH] ✅ User resolved by EMAIL fallback.');
            } else {
                // FALLBACK 2: Default/First User (Last resort)
                if (process.env.NODE_ENV === 'development') console.log(`[AUTH_DEBUG] 🚨 Fallback 2: fetchDefaultUser (last resort)`);
                const defaultUserRes = await import('@/app/actions').then(m => m.getDefaultUser());

                if (defaultUserRes.success && defaultUserRes.user) {
                    finalUser = defaultUserRes.user;
                    if (process.env.NODE_ENV === 'development') console.log('[AUTH] ✅ User resolved by DEFAULT fallback.');
                }
            }

            if (!finalUser) {
                console.error('[AUTH] ❌ No users found in DB (ID, Email, or Default). AuthChecked set to TRUE, redirection will happen if needed.');
                // Do NOT redirect here immediately, let the flow finish or redirect after state update
                if (pathname !== '/login') {
                    // router.push('/login'); // DELAY THIS
                }
                if (!silent) setIsLoading(false);
                return; // Early return is fine IF we handle redirect elsewhere or trigger it via effect
            }

            // AUTO-REPAIR: Update localStorage with found user
            if (process.env.NODE_ENV === 'development') console.log('[AUTH] Auto-repair: setting userId to', finalUser.id);
            if (typeof window !== 'undefined') {
                localStorage.setItem('glassy_current_user_id', finalUser.id);
            }
        } else {
            // User loaded successfully from storage
            finalUser = userResFromStorage.data;
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('[AUTH_DEBUG] User resolved:', {
                id: finalUser.id,
                email: finalUser.email,
            });
        }

        setUser(finalUser);
        setAuthChecked(true); // MARK AUTH AS CHECKED

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
            if (process.env.NODE_ENV === 'development') console.warn("No societies found in Database.");
            setSocietes([]);
            setSociete(null);
        }

        // DIAGNOSTIC: Log complete scoping BEFORE fetching
        if (process.env.NODE_ENV === 'development') {
            console.log('[DATA_SCOPE] 🔍 SCOPING CHECK:', {
                storageUserId: typeof window !== 'undefined' ? localStorage.getItem("glassy_current_user_id") : null,
                resolvedUserId: finalUser?.id,
                resolvedUserEmail: finalUser?.email,
                userCurrentSocieteId: finalUser?.currentSocieteId,
                activeSocieteId: activeSociete?.id,
                activeSocieteName: activeSociete?.nom,
                validSocietesCount: validSocietes.length
            });
        }

        if (activeSociete) {
            setSociete(activeSociete);
            const currentSocieteId = activeSociete.id;

            // DIAGNOSTIC: Log query params
            if (process.env.NODE_ENV === 'development') console.log(`[DATA_SCOPE] 🚀 FETCHING DATA for Societe: [${currentSocieteId}] "${activeSociete.nom}"`);

            // Parallelize Entity Fetches (already done, but keeping structure)
            const [clientsRes, productsRes, invoicesRes, quotesRes] = await Promise.all([
                fetchClients(currentSocieteId),
                fetchProducts(currentSocieteId),
                fetchInvoices(currentSocieteId),
                fetchQuotes(currentSocieteId)
            ]);

            if (process.env.NODE_ENV === 'development') {
                console.log('[DATA_SCOPE] ✅ QUERY RESULTS:', {
                    invoices: invoicesRes.success ? invoicesRes.data?.length : 'ERROR',
                    quotes: quotesRes.success ? quotesRes.data?.length : 'ERROR',
                    clients: clientsRes.success ? clientsRes.data?.length : 'ERROR',
                    products: productsRes.success ? productsRes.data?.length : 'ERROR'
                });
            }

            // Log details if empty
            if (invoicesRes.data?.length === 0) {
                if (process.env.NODE_ENV === 'development') console.warn('[DATA_SCOPE] ⚠️ Zero invoices returned. Checking DB directly via fetchInvoices("Euromedmultimedia")...');
            }

            // DIAGNOSTIC: Log final results
            if (process.env.NODE_ENV === 'development') {
                console.log('[RESULTS]', {
                    invoices: invoicesRes.data?.length || 0,
                    quotes: quotesRes.data?.length || 0,
                    clients: clientsRes.data?.length || 0,
                    products: productsRes.data?.length || 0
                });
            }

            if (quotesRes.success && quotesRes.data && quotesRes.data.length > 0) {
                const sample = quotesRes.data[0];
                if (process.env.NODE_ENV === 'development') {
                    console.log('[QUOTE_DEBUG] Sample Quote:', {
                        id: sample.id,
                        numero: sample.numero,
                        isLocked: (sample as any).isLocked,
                        keys: Object.keys(sample)
                    });
                }
            }

            if (clientsRes.success && clientsRes.data) setClients(clientsRes.data);
            if (productsRes.success && productsRes.data) setProducts(productsRes.data);
            if (invoicesRes.success && invoicesRes.data) setInvoices(invoicesRes.data);
            if (quotesRes.success && quotesRes.data) setQuotes(quotesRes.data);
        }

        if (!silent) setIsLoading(false);
        if (process.env.NODE_ENV !== "production") console.timeEnd("TotalLoadTime");

        // Lazy load history (15 items) to not block UI
        // Explicitly pass the resolved currentSocieteId to ensure we are fetching for the right scope
        const historyData = await dataService.getHistory(15, activeSociete ? activeSociete.id : undefined);
        setHistory(historyData);
    };

    useEffect(() => {
        dataService.initialize();

        // ONLY REDIRECT IF AUTH HAS BEEN CHECKED AND NO USER
        if (authChecked && !user && pathname !== "/login") {
            if (process.env.NODE_ENV === 'development') console.log("[AUTH_FLOW] Auth checked, no user found, Redirecting to /login");
            // Double check local storage one last time? No, rely on state.
            router.push("/login");
            setIsLoading(false);
            return;
        }

        // Initial fetch triggers
        if (!authChecked) { // Only fetch if we haven't resolved auth yet (or refreshing)
            fetchData();
        }
    }, [pathname, authChecked, user]);

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
