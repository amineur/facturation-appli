"use client";

import { useData } from "@/components/data-provider";
import { ArrowLeft, Save, User, Lock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { updateUserProfile } from "@/app/actions";
import { toast } from "sonner";

export function MobileProfile() {
    const { user, refreshData } = useData();
    const [isSaving, setIsSaving] = useState(false);

    // Desktop uses separate UserProfileEditor, likely in features/UserProfileEditor.tsx which uses updateUserProfile.
    // Let's implement basic form.

    const { register, handleSubmit, reset } = useForm({
        defaultValues: {
            fullName: user?.fullName || "",
            email: user?.email || "",
            currentPassword: "",
            newPassword: "",
            confirmPassword: ""
        }
    });

    useEffect(() => {
        if (user) {
            reset({
                fullName: user.fullName || "",
                email: user.email || "",
            });
        }
    }, [user, reset]);

    const onSubmit = async (data: any) => {
        if (data.newPassword && data.newPassword !== data.confirmPassword) {
            toast.error("Les mots de passe ne correspondent pas");
            return;
        }

        setIsSaving(true);
        try {
            const res = await updateUserProfile({
                fullName: data.fullName,
                email: data.email,
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            });

            if (res.success) {
                toast.success("Profil mis à jour");
                refreshData();
                reset({ ...data, currentPassword: "", newPassword: "", confirmPassword: "" });
            } else {
                toast.error("Erreur: " + res.error);
            }
        } catch (e: any) {
            toast.error("Erreur serveur");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="pb-32 bg-background min-h-screen">
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link href="/settings" className="p-2 -ml-2 rounded-full hover:bg-muted">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <h1 className="font-bold text-lg">Mon Profil</h1>
                </div>
                <button
                    onClick={handleSubmit(onSubmit)}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Enregistrer
                </button>
            </div>

            <div className="p-4 space-y-6">
                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-blue-500" /> Infos Personnelles
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Nom Complet</label>
                            <input {...register("fullName")} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Email</label>
                            <input {...register("email")} type="email" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
                    <h3 className="font-semibold mb-2 text-sm flex items-center gap-2">
                        <Lock className="h-4 w-4 text-orange-500" /> Sécurité
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Mot de passe actuel</label>
                            <input {...register("currentPassword")} type="password" placeholder="Requis pour changer de mot de passe" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Nouveau mot de passe</label>
                            <input {...register("newPassword")} type="password" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground ml-1">Confirmer mot de passe</label>
                            <input {...register("confirmPassword")} type="password" className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
