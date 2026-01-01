import type { Client } from '@/types';

/**
 * Get the display name for a client
 * - For individuals (INDIVIDUAL): Returns "Prénom Nom"
 * - For companies (COMPANY): Returns the company name (nom)
 */
export function getClientDisplayName(client: Client | null | undefined): string {
    if (!client) return '';

    // For individual clients, combine first and last name
    if (client.typeClient === 'INDIVIDUAL') {
        const firstName = client.prenomContact?.trim() || '';
        const lastName = client.nomContact?.trim() || '';

        if (firstName && lastName) {
            return `${firstName} ${lastName}`;
        }
        if (firstName) return firstName;
        if (lastName) return lastName;
    }

    // For company clients or fallback, use the nom field
    return client.nom || '';
}

/**
 * Get initials for a client avatar
 * - For individuals: Uses first letter of first name + first letter of last name
 * - For companies: Uses first two letters of company name
 */
export function getClientInitials(client: Client | null | undefined): string {
    if (!client) return '';

    if (client.typeClient === 'INDIVIDUAL') {
        const firstName = client.prenomContact?.trim() || '';
        const lastName = client.nomContact?.trim() || '';

        const firstInitial = firstName.charAt(0).toUpperCase();
        const lastInitial = lastName.charAt(0).toUpperCase();

        if (firstInitial && lastInitial) {
            return `${firstInitial}${lastInitial}`;
        }
        if (firstInitial) return firstInitial;
        if (lastInitial) return lastInitial;
    }

    // For companies, use first two letters of company name
    const name = client.nom || '';
    if (name.length >= 2) {
        return name.substring(0, 2).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

/**
 * Get searchable text for a client (used for filtering)
 * Includes all relevant name fields
 */
export function getClientSearchText(client: Client): string {
    const parts = [
        client.nom,
        client.prenomContact,
        client.nomContact,
        client.email,
    ].filter(Boolean);

    return parts.join(' ').toLowerCase();
}
