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

    // Generic fallback - DEBUG MODE: Return actual error
    return {
        success: false,
        error: `Erreur: ${error.message || String(error)}`
    };
}
