import { useState, useEffect } from "react";
import Image from "next/image";
import { User, Societe } from "@/types";
import { dataService } from "@/lib/data-service";
import { useData } from "@/components/data-provider";
import { Plus, Trash2, Edit2, Shield, User as UserIcon, Check, X, Building2, Mail, Save, Copy, Key } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface UserFormData {
    id?: string;
    email: string;
    fullName: string;
    role: "admin" | "user" | "viewer";
    societes: string[];
    password?: string; // Add password
}

export function UserManagement({ onBack }: { onBack: () => void }) {
    const { user: currentUser, societes } = useData();
    const [users, setUsers] = useState<User[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    useEffect(() => {
        setUsers(dataService.getUsers());
    }, []);

    const handleRevoke = (id: string) => {
        if (confirm("Êtes-vous sûr de vouloir révoquer l'accès de cet utilisateur ?")) {
            const newUsers = users.filter(u => u.id !== id);
            localStorage.setItem("glassy_users", JSON.stringify(newUsers));
            setUsers(newUsers);
        }
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsEditing(true);
    };

    const handleInvite = () => {
        setSelectedUser(null);
        setIsEditing(true);
    };

    const handleSave = (data: UserFormData) => {
        const isNew = !selectedUser;
        const newUser: User = {
            id: selectedUser?.id || `usr_${crypto.randomUUID()}`,
            ...data,
            permissions: selectedUser?.permissions || ["*"],
            currentSocieteId: selectedUser?.currentSocieteId
        };

        // Preserve password if not updated and editing
        if (!data.password && selectedUser?.password) {
            newUser.password = selectedUser.password;
        }

        dataService.saveUser(newUser);
        setUsers(dataService.getUsers());
        setIsEditing(false);

        if (isNew) {
            toast.success(`Utilisateur ${data.fullName} invité !`);
        } else {
            toast.success("Utilisateur mis à jour");
        }
    };

    if (isEditing) {
        return (
            <UserEditor
                user={selectedUser}
                societes={societes}
                onSave={handleSave}
                onCancel={() => setIsEditing(false)}
            />
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Gestion des utilisateurs</h2>
                    <p className="text-sm text-muted-foreground">Invitez des collaborateurs et gérez leurs accès multi-sociétés.</p>
                </div>
                <button
                    onClick={handleInvite}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-purple-500/20"
                >
                    <Mail className="h-4 w-4" />
                    Inviter un utilisateur
                </button>
            </div>

            <div className="grid gap-4">
                {users.map((user) => (
                    <div key={user.id} className="glass-card p-4 rounded-xl flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                                {user.fullName.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">{user.fullName}</h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{user.email}</span>
                                    <span>•</span>
                                    <span className="capitalize px-2 py-0.5 rounded-full bg-muted border border-border flex items-center gap-1 dark:bg-white/5 dark:border-white/10">
                                        {user.role === 'admin' && <Shield className="h-3 w-3 text-purple-400" />}
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2 mr-4">
                                {user.societes.map(socId => {
                                    const soc = societes.find(s => s.id === socId);
                                    if (!soc) return null;
                                    return (
                                        <div key={socId} className="h-6 w-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-white overflow-hidden" title={soc.nom}>
                                            {soc.logoUrl ? (
                                                <Image src={soc.logoUrl} alt={soc.nom} width={24} height={24} className="object-cover" unoptimized />
                                            ) : (
                                                soc.nom.charAt(0)
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => handleEdit(user)}
                                className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-blue-400 transition-colors"
                            >
                                <Edit2 className="h-4 w-4" />
                            </button>
                            {currentUser && user.id !== currentUser.id && (
                                <button
                                    onClick={() => handleRevoke(user.id)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-500 transition-colors"
                                    title="Révoquer l'accès"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function UserEditor({ user, societes, onSave, onCancel }: { user: User | null, societes: Societe[], onSave: (data: UserFormData) => void, onCancel: () => void }) {
    const { register, handleSubmit, watch, formState: { errors } } = useForm<UserFormData>({
        defaultValues: user ? {
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            societes: user.societes,
            password: user.password // Load password
        } : {
            role: "user",
            societes: []
        }
    });

    const [selectedSocietes, setSelectedSocietes] = useState<string[]>(user?.societes || []);
    const email = watch("email");

    const toggleSociete = (id: string) => {
        if (selectedSocietes.includes(id)) {
            setSelectedSocietes(selectedSocietes.filter(s => s !== id));
        } else {
            setSelectedSocietes([...selectedSocietes, id]);
        }
    };

    const onSubmit = (data: UserFormData) => {
        onSave({ ...data, societes: selectedSocietes });
    };

    const copyInviteLink = () => {
        const link = `${window.location.origin}/login?email=${encodeURIComponent(email || "")}`;
        navigator.clipboard.writeText(link);
        toast.success("Lien d'invitation copié !");
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">
                    {user ? "Modifier l'utilisateur" : "Inviter un nouvel utilisateur"}
                </h2>
                <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X className="h-5 w-5" />
                </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4">
                    {!user && (
                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-sm text-purple-200 flex flex-col gap-3">
                            <div className="flex gap-3">
                                <Mail className="h-5 w-5 shrink-0" />
                                <div>
                                    Envoyez ce lien à votre collaborateur pour qu'il puisse se connecter directement.
                                </div>
                            </div>
                            {email && (
                                <button
                                    type="button"
                                    onClick={copyInviteLink}
                                    className="flex items-center gap-2 self-start px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-xs font-medium transition-colors"
                                >
                                    <Copy className="h-3 w-3" />
                                    Copier le lien d'invitation
                                </button>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Nom complet</label>
                        <input
                            {...register("fullName", { required: true })}
                            className="w-full glass-input px-4 py-2.5 rounded-xl block"
                            placeholder="Ex: Sophie Martin"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Email</label>
                        <input
                            {...register("email", { required: true })}
                            type="email"
                            className="w-full glass-input px-4 py-2.5 rounded-xl block"
                            placeholder="sophie@example.com"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Mot de passe {!user && "(Défini par l'utilisateur plus tard si vide)"}</label>
                        <div className="relative">
                            <Key className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
                            <input
                                {...register("password")}
                                type="text"
                                className="w-full glass-input px-4 py-2.5 pl-10 rounded-xl block"
                                placeholder={user ? "Modifier le mot de passe" : "Mot de passe provisoire (optionnel)"}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Rôle</label>
                        <select
                            {...register("role")}
                            className="w-full glass-input px-4 py-2.5 rounded-xl block bg-transparent"
                        >
                            <option value="admin">Administrateur (Accès total)</option>
                            <option value="user">Utilisateur (Gestion courante)</option>
                            <option value="viewer">Observateur (Lecture seule)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-3 block">Accès aux sociétés</label>
                        <div className="grid gap-3">
                            {societes.map(soc => (
                                <div
                                    key={soc.id}
                                    onClick={() => toggleSociete(soc.id)}
                                    className={cn(
                                        "flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200",
                                        selectedSocietes.includes(soc.id)
                                            ? "bg-purple-500/20 border-purple-500/50"
                                            : "glass-card border-border hover:bg-muted/50 dark:border-white/5 dark:hover:bg-white/5"
                                    )}
                                >
                                    <div className={cn(
                                        "w-5 h-5 rounded-full border flex items-center justify-center mr-3 transition-colors",
                                        selectedSocietes.includes(soc.id)
                                            ? "bg-purple-500 border-purple-500"
                                            : "border-muted-foreground"
                                    )}>
                                        {selectedSocietes.includes(soc.id) && <Check className="h-3 w-3 text-white" />}
                                    </div>

                                    <div className="h-6 w-6 rounded-md bg-white/10 flex items-center justify-center mr-3 overflow-hidden">
                                        {soc.logoUrl ? (
                                            <Image src={soc.logoUrl} alt={soc.nom} width={24} height={24} className="object-cover" unoptimized />
                                        ) : (
                                            <Building2 className="h-3 w-3" />
                                        )}
                                    </div>

                                    <div className="flex -1">
                                        <span className="font-medium text-foreground">{soc.nom}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium shadow-lg shadow-purple-500/20 transition-colors"
                    >
                        {user ? (
                            <>
                                <Save className="h-4 w-4" />
                                Enregistrer
                            </>
                        ) : (
                            <>
                                <Mail className="h-4 w-4" />
                                Envoyer l'invitation
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
