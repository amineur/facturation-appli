"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/components/data-provider";
import { ArrowLeft, Send } from "lucide-react";
import { CommunicationsPanel } from "@/components/features/CommunicationsPanel";

export default function CommunicationsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { invoices, clients } = useData();

    const invoiceId = params.id as string;
    const invoice = invoices.find(inv => inv.id === invoiceId);
    const client = clients.find(c => c.id === invoice?.clientId);

    if (!invoice) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-muted-foreground">Facture non trouvée</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 flex flex-col space-y-6 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-4 flex-shrink-0">
                <button
                    onClick={() => router.back()}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent flex items-center gap-2">
                        <Send className="h-8 w-8" />
                        Historique d'envoi
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Facture {invoice.numero} - {client?.nom}
                    </p>
                </div>
            </div>

            {/* Main Content: Reusing the Panel for perfect synchronization */}
            <div className="flex-1 min-h-0 relative">
                <div className="absolute inset-0 overflow-y-auto custom-scrollbar pr-2">
                    <CommunicationsPanel
                        invoice={invoice}
                        defaultComposeOpen={false}
                        hideComposeButton={true}
                    />
                </div>
            </div>
        </div>
    );
}

