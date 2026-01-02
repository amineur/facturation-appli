"use client";

import { useData } from "@/components/data-provider";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClientAction, updateClient, deleteClient } from "@/lib/actions/clients";
// Using the aliases from existing actions or direct import?
// Checking actions.ts export: "export { createClientAction as importClient };" <- Wait, that's 'importClient'.
// Let's check 'src/lib/actions/clients.ts' for the real server actions.
// Assuming createClientAction, updateClientAction are exported there.

interface MobileClientEditorProps {
    id?: string;
}

export function MobileClientEditor({ id }: MobileClientEditorProps) {
    const router = useRouter();
    const { clients } = useData();
    const isEditing = !!id;

    // Form State
    const [nom, setNom] = useState("");
    const [email, setEmail] = useState("");
    const [telephone, setTelephone] = useState("");
    const [adresse, setAdresse] = useState("");
    const [ville, setVille] = useState("");
    const [codePostal, setCodePostal] = useState("");
    const [pays, setPays] = useState("France");
    const [siren, setSiren] = useState("");
    const [tvaIntra, setTvaIntra] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial Load
    useEffect(() => {
        if (isEditing && id) {
            const client = clients.find(c => c.id === id);
            if (client) {
                setNom(client.nom);
                setEmail(client.email || "");
                setTelephone(client.telephone || "");
                setAdresse(client.adresse || "");
                setVille(client.ville || "");
                setCodePostal(client.codePostal || "");
                setPays(client.pays || "France");
                setSiren(client.siren || "");
                setTvaIntra(client.tvaIntra || "");
            }
        }
    }, [id, clients, isEditing]);

    const handleSave = async () => {
        if (!nom) {
            toast.error("Le nom est obligatoire");
            return;
        }

        setIsSubmitting(true);
        try {
            const data = {
                nom,
                email,
                telephone,
                adresse,
                ville,
                codePostal,
                pays,
                siren,
                tvaIntra
            };

            if (isEditing && id) {
                // Update
                const result = await updateClient(id, data);
                if (result.success) {
                    toast.success("Client modifié !");
                    router.back();
                } else {
                    toast.error(result.error || "Erreur lors de la modification");
                }
            } else {
                // Create
                const result = await createClientAction(data);
                if (result.success) {
                    toast.success("Client créé !");
                    router.back();
                } else {
                    toast.error(result.error || "Erreur lors de la création");
                }
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur technique");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) return;

        setIsSubmitting(true);
        try {
            if (id) {
                const result = await deleteClient(id);
                if (result.success) {
                    toast.success("Client supprimé");
                    router.push("/clients");
                } else {
                    toast.error(result.error || "Impossible de supprimer (documents liés ?)");
                }
            }
        } catch (error) {
            toast.error("Erreur technique");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-muted/10 pb-32">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-white/10 p-4 flex items-center justify-between">
                <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft className="h-6 w-6" />
                </button>
                <span className="font-bold text-sm">{isEditing ? "Modifier Client" : "Nouveau Client"}</span>
                {isEditing ? (
                    <button onClick={handleDelete} className="p-2 -mr-2 rounded-full hover:bg-red-500/10 text-red-500">
                        <Trash2 className="h-5 w-5" />
                    </button>
                ) : <div className="w-10" />}
            </div>

            <div className="p-4 space-y-6">

                {/* Identity */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identité</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Nom / Société *</label>
                            <input
                                value={nom}
                                onChange={(e) => setNom(e.target.value)}
                                className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                placeholder="Ex: Acme Corp"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Email</label>
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                placeholder="contact@acme.com"
                                type="email"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Téléphone</label>
                            <input
                                value={telephone}
                                onChange={(e) => setTelephone(e.target.value)}
                                className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                placeholder="06..."
                            />
                        </div>
                    </div>
                </div>

                {/* Address */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adresse</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Adresse</label>
                            <input
                                value={adresse}
                                onChange={(e) => setAdresse(e.target.value)}
                                className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                placeholder="123 rue..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">Code Postal</label>
                                <input
                                    value={codePostal}
                                    onChange={(e) => setCodePostal(e.target.value)}
                                    className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">Ville</label>
                                <input
                                    value={ville}
                                    onChange={(e) => setVille(e.target.value)}
                                    className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Pays</label>
                            <input
                                value={pays}
                                onChange={(e) => setPays(e.target.value)}
                                className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Legal */}
                <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mentions Légales</p>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-1 block">SIREN</label>
                                <input
                                    value={siren}
                                    onChange={(e) => setSiren(e.target.value)}
                                    className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1 block">TVA Intra</label>
                                <input
                                    value={tvaIntra}
                                    onChange={(e) => setTvaIntra(e.target.value)}
                                    className="w-full bg-muted/30 border border-transparent focus:border-primary rounded-xl px-4 py-3 text-sm focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Bottom Bar Save */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border flex items-center justify-end z-[60]">
                <button
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="h-12 w-full rounded-xl bg-primary text-black font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                    <Save className="h-5 w-5" />
                    {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                </button>
            </div>
        </div>
    );
}
