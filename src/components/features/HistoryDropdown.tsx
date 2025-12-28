import { History, Clock, ArrowRight } from "lucide-react";
import { useData } from "@/components/data-provider";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function HistoryDropdown() {
    const { history, refreshData, user, markHistoryAsRead } = useData();
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);

    // Load last read from USER object (DB)
    useEffect(() => {
        if (user && user.lastReadHistory && history.length > 0) {
            const lastRead = new Date(user.lastReadHistory).getTime();
            const latest = new Date(history[0].timestamp).getTime();
            // If latest activity is newer than last read time
            if (latest > lastRead) {
                setHasUnread(true);
            } else {
                setHasUnread(false);
            }
        } else {
            // Default to no unread if user not loaded or empty history
            setHasUnread(false);
        }
    }, [history, user]);

    // Mark as read when opened (Server Action via Context)
    // Kept split to avoid infinite loop
    const hasMarkedRef = useRef(false);

    // Reset ref when closed
    useEffect(() => {
        if (!isOpen) {
            hasMarkedRef.current = false;
        }
    }, [isOpen]);

    // Mark as read when opened (Server Action via Context)
    // Guarded execution to allow safe dependency array
    useEffect(() => {
        if (isOpen && user && !hasMarkedRef.current) {
            hasMarkedRef.current = true;
            markHistoryAsRead();
            setHasUnread(false);
        }
    }, [isOpen, user, markHistoryAsRead]);

    // Trigger refresh ONLY when opening
    useEffect(() => {
        if (isOpen) {
            refreshData(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Get last 5 items
    const recentHistory = history.slice(0, 5);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Activités récentes"
                className="relative rounded-full p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            >
                <History className="h-5 w-5" />
                {hasUnread && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0f172a]" />
                )}
            </button>

            {isOpen && (
                <>
                    {/* Backdrop to close */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    <div className="absolute right-0 top-12 z-50 w-80 rounded-xl bg-background border border-border p-0 overflow-hidden animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                        <div className="p-4 border-b border-white/5 flex items-center justify-between">
                            <h4 className="font-semibold text-foreground flex items-center gap-2">
                                <Clock className="h-4 w-4 text-blue-400" />
                                Activité récente
                            </h4>
                            <span className="text-xs text-muted-foreground">{history.length} actions</span>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto">
                            {recentHistory.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    Aucune activité récente.
                                </div>
                            ) : (
                                <ul className="divide-y divide-white/5">
                                    {recentHistory.map((entry: any) => (
                                        <li key={entry.id} className="p-3 hover:bg-white/5 transition-colors">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-sm font-medium text-foreground">
                                                    {entry.userName}
                                                </div>
                                                <div className="text-sm text-muted-foreground line-clamp-2">
                                                    {entry.description}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {format(new Date(entry.timestamp), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="p-2 border-t border-white/5 bg-white/5">
                            <Link
                                href="/history"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center justify-center gap-2 w-full p-2 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors rounded-lg hover:bg-white/5"
                            >
                                Voir tout l'historique
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
