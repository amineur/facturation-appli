"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, User, Mail, Phone, Trash2, Upload, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { Client } from "@/types";
import { deleteRecord } from "@/app/actions";
import { toast } from "sonner";

export default function ClientsPage() {
    const { clients, refreshData, societe, confirm, logAction } = useData();
    const router = useRouter(); // Add router
    const [searchTerm, setSearchTerm] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredClients = clients.filter(client =>
        client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent row click
        // Find client name for logging
        const clientToDelete = clients.find(c => c.id === id);
        const nom = clientToDelete?.nom || "Client";

        confirm({
            title: "Supprimer le client",
            message: "Supprimer ce client ? Cette action est irréversible.",
            onConfirm: async () => {
                await deleteRecord('Clients', id);
                dataService.deleteClient(id);
                logAction('delete', 'client', `Client ${nom} supprimé`, id);
                refreshData();
            }
        });
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            const lines = text.split("\n");
            // Detect header line automatically or assume standard if not found
            // Based on user image: Numéro, Nom de l'entreprise, Numéro de SIRET, Numéro de TVA, Titre, Prénom, Nom de famille, E-mail, Téléphone, Portable, Adresse 1, Adresse 2, Code postal, Ville, Pays

            let count = 0;
            let startIndex = 0;

            // Simple heuristic: check if first line looks like a header
            if (lines[0].toLowerCase().includes("nom") || lines[0].toLowerCase().includes("siret")) {
                startIndex = 1;
            }

            for (let i = startIndex; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Handle basic CSV parsing (splitting by comma).
                // Note: deeply nested commas in values are not handled by simple split, but sufficient for basic usage.
                const cols = line.split(",").map(c => c.trim());

                // Map columns based on the user's provided structure (approximate index mapping)
                // 0: Numéro, 1: Nom Ent, 2: SIRET, 3: TVA, 4: Titre, 5: Prénom, 6: Nom, 7: Email, 8: Tel, 9: Mobile, 10: Adr1, 11: Adr2, 12: CP, 13: Ville, 14: Pays

                // Fallback for smaller CSVs - try to detect basic format
                let clientData: Partial<Client> = {};

                if (cols.length >= 14) {
                    clientData = {
                        reference: cols[0],
                        nom: cols[1], // Nom entreprise
                        siret: cols[2],
                        tvaIntra: cols[3],
                        // Contact: col 4(Titre) + 5(Prenom) + 6(Nom)
                        titreContact: cols[4],
                        prenomContact: cols[5],
                        nomContact: cols[6],
                        email: cols[7],
                        telephone: cols[8],
                        mobile: cols[9],
                        adresse: cols[10],
                        adresse2: cols[11],
                        codePostal: cols[12],
                        ville: cols[13],
                        pays: cols[14]
                    };
                } else if (cols.length >= 5) {
                    // Start standard format fallback: Nom, Email, Tel, Adr, CP, Ville
                    clientData = {
                        nom: cols[0],
                        email: cols[1],
                        telephone: cols[2],
                        adresse: cols[3],
                        codePostal: cols[4],
                        ville: cols[5]
                    };
                }

                if (clientData.nom && clientData.email) {
                    const newClient: Client = {
                        id: crypto.randomUUID(),
                        societeId: societe?.id || "soc_1", // Fallback if societe undefined
                        nom: clientData.nom,
                        email: clientData.email,
                        telephone: clientData.telephone || "",
                        mobile: clientData.mobile || "",
                        adresse: clientData.adresse || "",
                        adresse2: clientData.adresse2 || "",
                        codePostal: clientData.codePostal || "",
                        ville: clientData.ville || "",
                        pays: clientData.pays || "France",
                        siret: clientData.siret || "",
                        tvaIntra: clientData.tvaIntra || "",
                        reference: clientData.reference || "",
                        nomContact: clientData.nomContact || "",
                        prenomContact: clientData.prenomContact || "",
                        titreContact: clientData.titreContact || ""
                    };
                    dataService.saveClient(newClient);
                    count++;
                }
            }

            refreshData();
            const logMsg = count > 0 ? `${count} clients importés via CSV` : "Tentative d'import CSV (0 succès)";
            logAction('create', 'client', logMsg, 'import-batch');
            toast.success(`${count} clients importés avec succès !`);
            if (fileInputRef.current) fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                        Clients
                        <span className="text-lg font-medium text-muted-foreground bg-white/10 px-3 py-1 rounded-full border border-white/5">
                            {clients.length}
                        </span>
                    </h2>
                    <p className="text-muted-foreground mt-1">Gérez votre base de clients et prospects.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/clients/new" className="flex items-center gap-2 rounded-lg bg-blue-500/80 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20 backdrop-blur-sm">
                        <Plus className="h-4 w-4" />
                        Nouveau Client
                    </Link>
                </div>
            </div>

            <div className="glass-card rounded-xl p-4">
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Rechercher un client..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 w-full rounded-lg glass-input pl-10 pr-4 text-sm transition-all focus:ring-1 focus:ring-white/20 text-foreground"
                    />
                </div>

                <div className="rounded-lg">
                    {/* Desktop Table */}
                    <table className="hidden md:table w-full text-left text-sm text-muted-foreground">
                        <thead className="bg-primary/10 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-6 py-4 font-medium">Nom</th>
                                <th className="hidden md:table-cell px-6 py-4 font-medium">Contact</th>
                                <th className="hidden lg:table-cell px-6 py-4 font-medium">Adresse</th>
                                <th className="px-6 py-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredClients.map((client) => (
                                <tr
                                    key={client.id}
                                    onClick={() => router.push(`/clients/${client.id}`)}
                                    className="hover:bg-white/5 transition-colors group cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-blue-500 dark:text-blue-300 font-semibold border border-white/10 shrink-0">
                                                {(client.nom || "?")[0]?.toUpperCase() || "?"}
                                            </div>
                                            <div>
                                                <div className="font-medium text-foreground">{client.nom}</div>
                                                <div className="md:hidden text-xs text-muted-foreground mt-0.5">{client.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="hidden md:table-cell px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Mail className="h-3 w-3" />
                                                {client.email}
                                            </div>
                                            {client.telephone && (
                                                <div className="flex items-center gap-2">
                                                    <Phone className="h-3 w-3" />
                                                    {client.telephone}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="hidden lg:table-cell px-6 py-4">
                                        {client.adresse ? (
                                            <span className="truncate max-w-[200px] block" title={`${client.adresse}, ${client.codePostal} ${client.ville}`}>
                                                {client.adresse}, {client.codePostal} {client.ville}
                                            </span>
                                        ) : "-"}
                                    </td>
                                    <td className="px-6 py-4 text-right relative z-10">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}?edit=true`); }}
                                                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-blue-400 transition-colors"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, client.id)}
                                                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                        {filteredClients.map((client) => (
                            <div
                                key={client.id}
                                onClick={() => router.push(`/clients/${client.id}`)}
                                className="glass-card p-4 rounded-xl active:scale-[0.98] transition-all"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 text-blue-500 dark:text-blue-300 font-semibold border border-white/10 shrink-0">
                                            {(client.nom || "?")[0]?.toUpperCase() || "?"}
                                        </div>
                                        <div>
                                            <div className="font-medium text-foreground">{client.nom}</div>
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                                <Mail className="h-3 w-3" />
                                                {client.email}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); router.push(`/clients/${client.id}?edit=true`); }}
                                        className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-blue-400 transition-colors"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDelete(e, client.id)}
                                        className="p-2 bg-white/5 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredClients.length === 0 && (
                        <div className="px-6 py-12 text-center text-muted-foreground">
                            Aucun client trouvé pour "{searchTerm}"
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
