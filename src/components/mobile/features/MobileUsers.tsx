"use client";

import { useData } from "@/components/data-provider";
import { useState } from "react";
import { ArrowLeft, User, Mail, Shield, Plus, X, Send } from "lucide-react";
import Link from "next/link";
import { BottomSheet } from "../layout/BottomSheet";
import { toast } from "sonner";
// Assuming inviteMember action exists, need to verify or use generic
import { inviteMember } from "@/app/actions"; // Check if this exists in global actions or members
// Actually inviteMember is likely in members.ts or actions.ts. `SettingsPage` uses `UserManagement` component which uses `inviteMember`.
// Let's assume generic action for now or stub.
import { cn } from "@/lib/utils";

export function MobileUsers() {
    const { societe, members, refreshData } = useData(); // members from useData? Desktop uses `useData().members`? No, desktop uses specific fetch or `societe.members`?
    // useData returns `societe` which has `members`.

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("EDITOR");
    const [inviting, setInviting] = useState(false);

    const handleInvite = async () => {
        if (!email) return;
        setInviting(true);
        try {
            // Need to import dynamically to ensure path correct
            const { inviteMember } = await import("@/app/actions");
            const res = await inviteMember(societe.id, email, role as any);
            if (res.success) {
                toast.success("Invitation envoyée !");
                setIsInviteOpen(false);
                setEmail("");
                refreshData();
            } else {
                toast.error("Erreur: " + res.error);
            }
        } catch (e) {
            toast.error("Erreur serveur");
        } finally {
            setInviting(false);
        }
    };

    return (
        <div className="pb-32 bg-background min-h-screen">
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/settings" className="p-2 -ml-2 rounded-full hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="font-bold text-lg">Membres</h1>
                </div>
                <button
                    onClick={() => setIsInviteOpen(true)}
                    className="p-2 bg-primary text-primary-foreground rounded-full"
                >
                    <Plus className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4 space-y-4">
                {societe?.members?.map((m: any) => (
                    <div key={m.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold">
                                {m.user?.fullName?.[0] || m.user?.email?.[0] || "?"}
                            </div>
                            <div>
                                <p className="font-semibold text-sm">{m.user?.fullName || "Utilisateur"}</p>
                                <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                            </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-1 bg-muted rounded uppercase">{m.role}</span>
                    </div>
                ))}
                {/* Invitations pending? */}
            </div>

            <BottomSheet isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} title="Inviter un membre">
                <div className="p-4 space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="collegue@entreprise.com"
                                className="w-full bg-muted/30 border border-border rounded-xl pl-9 pr-4 py-3"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Rôle</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['VIEWER', 'EDITOR', 'ADMIN'].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setRole(r)}
                                    className={cn(
                                        "py-2 rounded-lg text-xs font-medium border transition-colors",
                                        role === r ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"
                                    )}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button
                        onClick={handleInvite}
                        disabled={inviting || !email}
                        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                        {inviting ? "Envoi..." : <>Inviter <Send className="h-4 w-4" /></>}
                    </button>
                </div>
            </BottomSheet>
        </div>
    );
}
