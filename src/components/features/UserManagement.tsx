import { useState, useEffect } from "react";
import Image from "next/image";
import { User, Societe } from "@/types";
import { useData } from "@/components/data-provider";
import { Plus, Trash2, Edit2, Shield, User as UserIcon, Check, X, Building2, Mail, Save, Copy, Key, Loader2, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { getMembers, inviteMember, updateMemberRole, removeMember, revokeInvitation, canAccessSociete } from "@/lib/actions/members";

import { MembershipRole } from "@prisma/client";

interface Invitation {
    id: string;
    email: string;
    role: MembershipRole;
    status: string;
    token: string;
}

interface UserWithRole {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
    role: MembershipRole;
}

export function UserManagement() {
    const { societe, user: currentUser } = useData();
    const [members, setMembers] = useState<UserWithRole[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    const [canManage, setCanManage] = useState(false);

    useEffect(() => {
        if (societe) {
            fetchMembers();
            checkPermissions();
        }
    }, [societe]);

    const checkPermissions = async () => {
        if (!societe || !currentUser) return;
        // Client-side check for UI (Server validates actions)
        // We assume we can manage if we are at least ADMIN
        // This is just for showing/hiding buttons, real security is on server.
        // For accurate check we'd need to fetch our own membership role, but fetching members does that.
    };

    const fetchMembers = async () => {
        if (!societe) return;
        setIsLoading(true);
        const res = await getMembers(societe.id);
        if (res.success && res.data) {
            // Transform to flat structure for UI
            const mappedMembers = res.data.members.map((m: any) => ({
                ...m.user,
                role: m.role
            }));
            const sortedMembers = mappedMembers.sort((a: any, b: any) => {
                const hierarchy = { OWNER: 4, ADMIN: 3, EDITOR: 2, VIEWER: 1 };
                return hierarchy[b.role as MembershipRole] - hierarchy[a.role as MembershipRole];
            });

            setMembers(sortedMembers);
            setInvitations(res.data.invitations);

            // Determine if current user can manage
            const myMembership = res.data.members.find((m: any) => m.user.id === currentUser?.id);
            if (myMembership) {
                const role = myMembership.role as MembershipRole;
                setCanManage(role === 'OWNER' || role === 'ADMIN');
            }
        } else {
            toast.error("Impossible de charger les membres");
        }
        setIsLoading(false);
    };

    const handleRemove = async (userId: string) => {
        if (!societe) return;
        if (!confirm("Êtes-vous sûr de vouloir retirer ce membre ?")) return;

        const res = await removeMember({ userId, societeId: societe.id });
        if (res.success) {
            toast.success("Membre retiré");
            fetchMembers();
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleRevokeInvite = async (invitationId: string) => {
        if (!confirm("Annuler l'invitation ?")) return;
        const res = await revokeInvitation(invitationId);
        if (res.success) {
            toast.success("Invitation annulée");
            fetchMembers();
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    const handleRoleChange = async (userId: string, newRole: MembershipRole) => {
        if (!societe) return;
        const res = await updateMemberRole({ userId, role: newRole, societeId: societe.id });
        if (res.success) {
            toast.success("Rôle mis à jour");
            fetchMembers();
        } else {
            toast.error(res.error || "Erreur");
        }
    };

    if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-foreground">Membres & Accès</h2>
                    <p className="text-sm text-muted-foreground">Gérez les accès à <strong>{societe?.nom}</strong> uniquement.</p>
                </div>
                {canManage && (
                    <button
                        onClick={() => setIsInviteModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm shadow-lg shadow-purple-500/20"
                    >
                        <Mail className="h-4 w-4" />
                        Inviter un membre
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {/* Invitations Section */}
                {invitations.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider ml-1">En attente ({invitations.length})</h3>
                        {invitations.map(invite => (
                            <div key={invite.id} className="glass-card p-3 rounded-xl flex items-center justify-between border-l-4 border-l-yellow-500/50">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-foreground">{invite.email}</div>
                                        <div className="text-xs text-muted-foreground">Invité en tant que <span className="font-mono">{invite.role}</span></div>
                                    </div>
                                </div>
                                {canManage && (
                                    <div className="flex items-center gap-2">
                                        <button

                                            onClick={() => {
                                                navigator.clipboard.writeText(invite.token);
                                                toast.success("Code d'invitation copié");
                                            }}
                                            className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground"
                                            title="Copier le code"
                                        >
                                            <Key className="h-4 w-4" />

                                        </button>
                                        <button
                                            onClick={() => handleRevokeInvite(invite.id)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-red-400"
                                            title="Annuler"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Members List */}
                <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider ml-1">Membres actifs ({members.length})</h3>
                    {members.map(member => (
                        <div key={member.id} className="glass-card p-4 rounded-xl flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                                    {member.fullName?.charAt(0) || member.email.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-medium text-foreground flex items-center gap-2">
                                        {member.fullName || "Utilisateur sans nom"}
                                        {member.id === currentUser?.id && <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">Vous</span>}
                                    </h3>
                                    <div className="text-xs text-muted-foreground">{member.email}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <RoleBadge role={member.role} />

                                {canManage && member.role !== 'OWNER' && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <select
                                            value={member.role}
                                            onChange={(e) => handleRoleChange(member.id, e.target.value as MembershipRole)}
                                            className="bg-transparent text-xs border border-white/10 rounded px-2 py-1 text-muted-foreground focus:text-foreground"
                                        >
                                            <option value="ADMIN">Admin</option>
                                            <option value="EDITOR">Éditeur</option>
                                            <option value="VIEWER">Lecteur</option>
                                        </select>
                                        <button
                                            onClick={() => handleRemove(member.id)}
                                            className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {isInviteModalOpen && societe && (
                <InviteModal
                    societeId={societe.id}
                    onClose={() => setIsInviteModalOpen(false)}
                    onSuccess={() => {
                        setIsInviteModalOpen(false);
                        fetchMembers();
                    }}
                />
            )}
        </div>
    );
}

function RoleBadge({ role }: { role: MembershipRole }) {
    const styles = {
        OWNER: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        ADMIN: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        EDITOR: "bg-green-500/20 text-green-300 border-green-500/30",
        VIEWER: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    };

    return (
        <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border border-transparent uppercase tracking-wide", styles[role])}>
            {role}
        </span>
    );
}


function InviteModal({ societeId, onClose, onSuccess }: { societeId: string, onClose: () => void, onSuccess: () => void }) {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string, role: MembershipRole }>();
    const [inviteCode, setInviteCode] = useState<string | null>(null);

    const onSubmit = async (data: { email: string, role: MembershipRole }) => {

        const res = await inviteMember({ ...data, societeId });
        if (res.success) {
            toast.success(res.message);
            if (res.token) {
                setInviteCode(res.token);
            } else {
                onSuccess();
            }
        } else {
            toast.error(res.error || "Erreur lors de l'invitation");
        }
    };

    if (inviteCode) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-[#1A1A1A] w-full max-w-md rounded-xl shadow-2xl border border-white/10 p-6 animate-in zoom-in-95 duration-200 text-center">
                    <div className="h-12 w-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Invitation envoyée !</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                        L'utilisateur a reçu un email. Vous pouvez aussi lui transmettre ce code manuellement :
                    </p>

                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 relative group">
                        <code className="text-2xl font-mono font-bold tracking-widest text-purple-400 select-all">
                            {inviteCode}
                        </code>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(inviteCode);
                                toast.success("Code copié !");
                            }}
                            className="absolute right-2 top-2 p-2 hover:bg-white/10 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copier"
                        >
                            <Copy className="h-4 w-4" />
                        </button>
                    </div>

                    <button
                        onClick={onSuccess}
                        className="w-full py-2 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors font-medium text-sm"
                    >
                        Terminer
                    </button>
                </div>
            </div>
        );
    }


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-[#1A1A1A] w-full max-w-md rounded-xl shadow-2xl border border-white/10 p-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Inviter un membre</h3>
                    <button onClick={onClose}><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Email</label>
                        <input
                            {...register("email", { required: true })}
                            type="email"
                            className="w-full glass-input px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                            placeholder="collegue@example.com"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-muted-foreground mb-1 block">Rôle</label>
                        <select
                            {...register("role", { required: true })}
                            className="w-full glass-input px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                        >
                            <option value="VIEWER">Lecteur (Voir seulement)</option>
                            <option value="EDITOR">Éditeur (Créer factures/devis)</option>
                            <option value="ADMIN">Admin (Gérer membres)</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-white">Annuler</button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                            Envoyer l'invitation
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
