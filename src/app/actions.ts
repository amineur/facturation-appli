// Facade for Server Actions

// Re-exporting from modular architecture
export type { ActionState } from '@/lib/actions/shared';
export * from '@/lib/actions/auth';
export * from '@/lib/actions/societes';
export * from '@/lib/actions/products';
export * from '@/lib/actions/clients';
export * from '@/lib/actions/invoices';
export * from '@/lib/actions/quotes';
export * from '@/lib/actions/history';
export * from '@/lib/actions/dashboard';
export * from '@/lib/actions/emails';

// Aliases for backward compatibility or semantic naming
import { createClientAction } from '@/lib/actions/clients';
export { createClientAction as importClient };

import { createProduct } from '@/lib/actions/products';
export { createProduct as importProduct };
