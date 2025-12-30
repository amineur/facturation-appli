"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
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
    createSociete: (nom: string, details?: any) => Promise<any>;
    updateSociete: (societe: Societe) => Promise<any>;
    refreshData: (silent?: boolean) => Promise<void>;
    isLoading: boolean;
    isDirty: boolean;
    setIsDirty: (dirty: boolean) => void;
    history: any[];
    logAction: (action: 'create' | 'update' | 'delete' | 'read' | 'other', entityType: 'facture' | 'devis' | 'client' | 'produit' | 'societe' | 'settings', description: string, entityId?: string) => void;
    confirm: (options: ConfirmOptions) => void;
    markHistoryAsRead: () => Promise<void>;
    // Optimistic Updates Helpers
    addInvoice: (invoice: Facture) => void;
    updateInvoiceInList: (invoice: Facture) => void;
    removeInvoice: (id: string) => void;
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

    // MUTEX: Prevent parallel fetches
    // const isFetchingRef = ... (Removed redundant logic)

    // MUTEX: Proper useRef for persistence across renders
    const fetchingRef = useRef(false);

    const fetchData = async (silent: boolean = false) => {
        // MUTEX GUARD
        if (fetchingRef.current) {
            return;
        }
        // SKIP on Guest Routes to prevent "Server Action Not Found" errors during login flow
        if (pathname?.startsWith('/login') || pathname?.startsWith('/signup')) {
            setIsLoading(false);
            return;
        }
        fetchingRef.current = true;

        const startTime = performance.now();
        if (!silent) setIsLoading(true);

        try {





            // 1. Parallelize Initial Independent Fetches
            // Run independent tasks concurrently
            updateOverdueInvoices().catch(e => { if (process.env.NODE_ENV === 'development') console.error("Overdue error (bg)", e); });

            const [societesRes] = await Promise.all([
                fetchSocietes().catch(e => { console.error("Societes fetch error", e); return { success: false, data: [] }; })
            ]);

            // 2. Process User - AUTH SYNC (Cookie -> Client)
            let finalUser = null;
            let userId = typeof window !== 'undefined' ? localStorage.getItem("glassy_current_user_id") : null;

            // Always verify against server session to prevent stale localStorage on account switch
            const sessionRes = await import("@/app/actions").then(mod => mod.getCurrentUser());

            if (sessionRes && sessionRes.success) {
                // @ts-ignore
                const sessionUser = sessionRes.data || sessionRes.user;
                if (sessionUser) {
                    // SERVER AUTHORITY: If session user differs from local, session wins.
                    if (userId && userId !== sessionUser.id) {
                        console.warn("[AUTH] Local user mismatch. Syncing with server session.");
                        if (typeof window !== 'undefined') {
                            localStorage.setItem("glassy_current_user_id", sessionUser.id);
                            // Clear stale society data as safety
                            localStorage.removeItem("glassy_active_societe");
                        }
                    }
                    userId = sessionUser.id;
                    finalUser = sessionUser;
                }
            }

            // Fallback: If no session (e.g. cookie expired), try local only if strictly necessary
            if (!finalUser && userId) {
                // Try fetching by ID from storage (Legacy/Dev path)
                const userResResult = await fetchUserById(userId).catch(e => { console.error("User fetch error", e); return { success: false, data: null }; });
                if (userResResult && userResResult.success) {
                    finalUser = userResResult.data;
                }
            }

            // If STILL no user, attempt auto-repair (Dev Fallback) or redirect
            if (!finalUser) {
                // FALLBACK 1: By Email ...
                const TARGET_EMAIL = "amine@euromedmultimedia.com";
                const allUsersRes = await fetchAllUsers();
                const foundByEmail = allUsersRes.success && allUsersRes.data
                    ? allUsersRes.data.find((u: any) => u.email === TARGET_EMAIL)
                    : null;

                if (foundByEmail) {
                    finalUser = foundByEmail;
                } else {
                    const defaultUserRes = await import('@/app/actions').then(m => m.getDefaultUser());
                    if (defaultUserRes.success && defaultUserRes.data) {
                        finalUser = defaultUserRes.data;
                    }
                }

                if (!finalUser) {
                    if (pathname !== '/login') {
                        console.warn('[AUTH] ⚠️ No active user session found. Redirecting to login...');
                    }
                    if (!silent) setIsLoading(false);
                    return;
                }

                // Repair storage
                if (typeof window !== 'undefined') {
                    localStorage.setItem('glassy_current_user_id', finalUser.id);
                }
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
                // Cache full Name for Header Optimism
                if (finalUser.fullName) localStorage.setItem("glassy_user_name_cache", finalUser.fullName);
            }


            // 3. Process Societes & Entity Data
            let validSocietes: Societe[] = [];
            let activeSociete: Societe | undefined;
            let shouldRedirectToOnboarding = false;

            if (societesRes && societesRes.success && societesRes.data) {
                validSocietes = societesRes.data as Societe[];
                setSocietes(validSocietes);
            }

            // --- SCOPE RESOLUTION LOGIC ---
            if (validSocietes.length === 0) {
                // Case 0: No societies

                shouldRedirectToOnboarding = true;
                setSociete(null);

                // Clean stale storage if any
                if (typeof window !== 'undefined') localStorage.removeItem("glassy_active_societe");

            } else {
                // Case 1+: Check stored ID
                let storedId = dataService.getActiveSocieteId(); // might return "soc_1" default

                // Validate stored ID against real list
                activeSociete = validSocietes.find(s => s.id === storedId);

                if (!activeSociete) {
                    // Invalid or Stale ID
                    if (validSocietes.length === 1) {
                        // Auto-fix: Only one choice
                        activeSociete = validSocietes[0];

                        dataService.switchSociete(activeSociete.id); // Valid switch (persists)
                    } else {
                        // Multiple choices but invalid ID -> Default to first (Soft fallback)
                        // (Ideally redirect to /societe/select, but for now fallback to first is smoother)
                        activeSociete = validSocietes[0];

                        dataService.switchSociete(activeSociete.id);
                    }
                }
            }

            // --- END RESOLUTION ---

            if (shouldRedirectToOnboarding) {
                if (pathname !== "/onboarding" && pathname !== "/login") {
                    router.push("/onboarding");
                }
                if (!silent) setIsLoading(false);
                return; // STOP HERE
            }

            // Only fetch data if we have an active society
            if (activeSociete) {
                setSociete(activeSociete);
                const currentSocieteId = activeSociete.id;

                // Ensure dataService knows about it (sync)
                if (typeof window !== 'undefined' && localStorage.getItem("glassy_active_societe") !== currentSocieteId) {
                    localStorage.setItem("glassy_active_societe", JSON.stringify(activeSociete));
                }

                // DIAGNOSTIC: Log query params

                // OPTIMIZED: Single DB call instead of 4 parallel calls
                const t0 = performance.now();


                const [clientsRes, productsRes, dashboardRes] = await Promise.all([
                    fetchClients(currentSocieteId),
                    fetchProducts(currentSocieteId),
                    import("@/lib/actions/dashboard").then(mod => mod.fetchDashboardData(userId!, currentSocieteId))
                ]);

                const t1 = performance.now();




                // Log details if empty
                if (dashboardRes.data?.invoices.length === 0) {

                }

                // Update state with dashboard data
                if (dashboardRes.success && dashboardRes.data) {
                    setInvoices(dashboardRes.data.invoices as Facture[]);
                    setQuotes(dashboardRes.data.quotes as Devis[]);
                }

                if (clientsRes.success && clientsRes.data) setClients(clientsRes.data);
                if (productsRes.success && productsRes.data) setProducts(productsRes.data);
            } else {
                // Should be unreachable due to onboarding check, but guard anyway

            }

            if (!silent) setIsLoading(false);


            // Lazy load history (15 items) to not block UI
            // Explicitly pass the resolved currentSocieteId to ensure we are fetching for the right scope
            const historyData = await dataService.getHistory(15, activeSociete ? activeSociete.id : undefined);
            setHistory(historyData);
        } catch (error) {
            console.error("[DATA_PROVIDER] Uncaught error in fetchData:", error);
        } finally {
            fetchingRef.current = false;
        }
    };

    useEffect(() => {
        dataService.initialize();

        // ONLY REDIRECT IF AUTH HAS BEEN CHECKED AND NO USER
        if (authChecked && !user && pathname !== "/login") {

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

    const handleCreateSociete = async (nom: string, details?: any) => {
        setIsLoading(true);
        const res = await createSocieteAction(nom, details);
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

    // CRON POLL (Kept for Dev/Self-Hosting where external cron is unavailable)
    useEffect(() => {
        const checkScheduled = async () => {
            try {
                // Low priority fetch
                await fetch('/api/cron/process-scheduled-emails', { priority: 'low' });
            } catch (e) {
                // Silent fail
            }
        };
        // Run on mount
        checkScheduled();
        // Run every minute (60000ms)
        const interval = setInterval(checkScheduled, 60000);
        return () => clearInterval(interval);
    }, []);

    const handleAddInvoice = (inv: Facture) => {
        setInvoices(prev => [inv, ...prev]);
    };

    const handleUpdateInvoiceInList = (inv: Facture) => {
        setInvoices(prev => prev.map(item => item.id === inv.id ? inv : item));
    };

    const handleRemoveInvoice = (id: string) => {
        setInvoices(prev => prev.filter(item => item.id !== id));
    };

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

                if (currentUser) {
                    await dataService.logAction(currentUser, action, entityType, description, entityId);
                    // OPTIMIZATION: Do NOT trigger full app refresh here. 
                    // Just update the history locally or fetch only history.
                    const newHistory = await dataService.getHistory(15, societe?.id);
                    setHistory(newHistory);
                } else {
                    console.error("[DataProvider] Action NOT logged: No user identified");
                }
            },
            confirm,
            markHistoryAsRead: handleMarkHistoryRead,
            addInvoice: handleAddInvoice,
            updateInvoiceInList: handleUpdateInvoiceInList,
            removeInvoice: handleRemoveInvoice
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
