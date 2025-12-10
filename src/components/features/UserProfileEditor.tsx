
import { useState } from "react";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { User, Shield, Mail, Key, Save, User as UserIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface ProfileFormData {
    fullName: string;
    email: string;
    currentPassword?: string; // Optional verification
    newPassword?: string;
}

export function UserProfileEditor({ onBack }: { onBack?: () => void }) {
    const { user, refreshData } = useData();
    const [isSaving, setIsSaving] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<ProfileFormData>({
        defaultValues: {
            fullName: user?.fullName || "",
            email: user?.email || ""
        }
    });

    const onSubmit = async (data: ProfileFormData) => {
        if (!user) return;
        setIsSaving(true);
        try {
            // Create updated user object
            const updatedUser = { ...user, fullName: data.fullName, email: data.email };

            // Handle password change
            if (data.newPassword) {
                updatedUser.password = data.newPassword;
            }

            dataService.saveUser(updatedUser);
            refreshData(); // Updates the global user context
            toast.success("Profil mis à jour avec succès");
        } catch (error) {
            console.error(error);
            toast.error("Erreur lors de la mise à jour");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return <div>Chargement...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-foreground">Mon Profil</h2>
                <p className="text-sm text-muted-foreground">Gérez vos informations personnelles et vos accès.</p>
            </div>

            <div className="glass-card p-6 rounded-xl border border-white/5 space-y-6">
                <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                    <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                        {user.fullName.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-foreground">{user.fullName}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Shield className="h-3 w-3 text-purple-400" />
                            <span className="capitalize">{user.role}</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Nom complet</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    {...register("fullName", { required: true })}
                                    className="w-full glass-input pl-9 py-2 rounded-lg"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    {...register("email", { required: true })}
                                    className="w-full glass-input pl-9 py-2 rounded-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                        <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                            <Key className="h-4 w-4 text-blue-400" />
                            Sécurité
                        </h4>
                        <div className="space-y-2 max-w-md">
                            <label className="text-sm font-medium text-muted-foreground">Nouveau mot de passe</label>
                            <input
                                {...register("newPassword")}
                                type="password"
                                placeholder="Laisser vide pour conserver l'actuel"
                                className="w-full glass-input px-4 py-2 rounded-lg"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            Enregistrer les modifications
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
