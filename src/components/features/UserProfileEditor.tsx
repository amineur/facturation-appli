import { useState, useEffect } from "react";
import { useData } from "@/components/data-provider";
import { dataService } from "@/lib/data-service";
import { User, Shield, Mail, Key, Save, User as UserIcon, Camera, X } from "lucide-react";
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
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    // Removed useEffect that sets avatarPreview from user.avatarUrl to allow "source of truth" logic in render.
    // The render logic now handles (avatarPreview || serverUrl).

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileFormData>({
        defaultValues: {
            fullName: user?.fullName || "",
            email: user?.email || ""
        }
    });


    const [pendingInvitations, setPendingInvitations] = useState<any[]>([]);

    useEffect(() => {
        if (user) {
            reset({
                fullName: user.fullName,
                email: user.email,
                newPassword: ""
            });
            fetchInvitations();
        }
    }, [user, reset]);

    const fetchInvitations = async () => {
        const { getMyPendingInvitations } = await import('@/lib/actions/members');
        const res = await getMyPendingInvitations();
        if (res.success && res.data) {
            setPendingInvitations(res.data);
        }
    };

    const handleAcceptInvite = async (token: string) => {
        const { acceptInvitation } = await import('@/lib/actions/members');
        const toastId = toast.loading("Acceptation en cours...");
        const res = await acceptInvitation(token);
        toast.dismiss(toastId);

        if (res.success) {
            toast.success(res.message);
            await refreshData();
            fetchInvitations();
            // Optional: Redirect if it switches current company, but refreshData handles context
        } else {
            toast.error(res.error || "Erreur lors de l'acceptation");
        }
    };

    const onSubmit = async (data: ProfileFormData) => {
        if (!user) return;
        setIsSaving(true);
        try {
            // 1. Handle Avatar Upload First (if pending)
            console.log("[DEBUG] Starting Save. Pending File?", !!pendingFile);
            if (pendingFile) {
                const formData = new FormData();
                formData.append('file', pendingFile);
                formData.append('userId', user.id);

                const res = await fetch('/api/users/avatar', {
                    method: 'POST',
                    body: formData,
                });

                const jsonRes = await res.json();
                console.log("[DEBUG] Upload Response:", res.status, jsonRes);

                if (!res.ok) {
                    throw new Error(jsonRes.error || 'Avatar upload failed');
                }
            }

            // 2. Handle Profile Data Update
            const updatedUser = { ...user, fullName: data.fullName, email: data.email };
            if (data.newPassword) {
                updatedUser.password = data.newPassword;
            }

            // Note: We don't set avatarUrl manually here because the server action/DB
            // manages it via the upload or the user fetch. 
            // The refreshData() call below will pull the new avatarUrl.

            console.log("[DEBUG] Sending Update User Payload:", updatedUser);

            await dataService.saveUser(updatedUser);

            // 3. Global Refresh to update Header
            await refreshData();

            setPendingFile(null);
            setAvatarPreview(null); // Reset preview to force fallback to user.avatarUrl (now updated in context)
            toast.success("Profil mis à jour avec succès");
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Erreur lors de la mise à jour");
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
                    <div className="relative group">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg overflow-hidden border-2 border-white/10">
                            {(() => {
                                // Priority: 1. Local Preview (Pending) -> 2. Server URL (Confirmed) -> 3. Fallback Initials
                                const showPreview = !!avatarPreview;
                                const showServer = !avatarPreview && (user as any)?.hasAvatar;

                                if (showPreview) {
                                    return <img src={avatarPreview!} alt="Avatar Preview" className="h-full w-full object-cover" />;
                                }
                                if (showServer) {
                                    return <img
                                        src={`/api/users/avatar/${user.id}?t=${user.updatedAt ? new Date(user.updatedAt).getTime() : 0}`}
                                        alt="Avatar"
                                        className="h-full w-full object-cover"
                                    />;
                                }
                                return user.fullName.charAt(0);
                            })()}
                        </div>
                        <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                            <Camera className="h-6 w-6 text-white" />
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
                                        toast.error("L'image est trop volumineuse (max 2MB)");
                                        return;
                                    }

                                    // Local Preview + Pending State Only
                                    setPendingFile(file);
                                    setAvatarPreview(URL.createObjectURL(file));
                                }}
                            />
                        </label>
                        {avatarPreview && (
                            <button
                                onClick={() => {
                                    setAvatarPreview(null);
                                    setPendingFile(null);
                                }}
                                className="absolute -top-1 -right-1 bg-red-500 rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                            >
                                <X className="h-3 w-3 text-white" />
                            </button>
                        )}
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
                            <label className="text-sm font-medium text-muted-foreground">Nom</label>
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


                    <div className="pt-4 border-t border-white/5">
                        <h4 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                            <Mail className="h-4 w-4 text-purple-400" />
                            Invitations en attente
                        </h4>

                        {pendingInvitations.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Aucune invitation en attente.</p>
                        ) : (
                            <div className="space-y-3">
                                {pendingInvitations.map((invite) => (
                                    <div key={invite.id} className="glass-card p-3 rounded-lg flex items-center justify-between border border-purple-500/20 bg-purple-500/5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-300 font-bold uppercase text-xs">
                                                {invite.societe.nom.substring(0, 2)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-foreground">{invite.societe.nom}</div>
                                                <div className="text-xs text-muted-foreground">Invité par {invite.inviter.fullName}</div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleAcceptInvite(invite.token)}
                                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors shadow shadow-purple-500/20"
                                        >
                                            Accepter
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
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
