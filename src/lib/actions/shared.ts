// Shared utils (not a server action boundary)

export interface ActionState<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    fieldErrors?: Record<string, string>;
    id?: string; // For create actions
}

export function handleActionError(error: any): ActionState {
    console.error("Server Action Error:", error);

    // Prisma Unique Constraint Error
    if (error.code === 'P2002') {
        const field = error.meta?.target?.[0] || 'Unknown';
        return {
            success: false,
            error: `La valeur pour ${field} existe déjà.`
        };
    }

    // Prisma Foreign Key Constraint Error
    if (error.code === 'P2003') {
        const field = error.meta?.field_name || 'référence';
        if (field.includes('client')) {
            return {
                success: false,
                error: "Le client sélectionné n'existe plus. Veuillez rafraîchir la page (F5) et sélectionner un client valide."
            };
        }
        return {
            success: false,
            error: `Référence invalide (${field}). Veuillez rafraîchir la page et réessayer.`
        };
    }

    // Generic fallback - DEBUG MODE: Return actual error
    return {
        success: false,
        error: `Erreur: ${error.message || String(error)}`
    };
}
