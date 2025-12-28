# Server Actions - Architecture Guide

## 📁 Structure

```
src/app/
├── actions.ts              ← Point d'export principal (51 server actions)
└── client-actions.ts       ← Actions spécifiques clients (2 actions)
```

## 🎯 Convention de Nommage

**TOUTES les Server Actions utilisent le suffixe `-Action`**

### ✅ Correct
```ts
createClientAction()
updateClientAction()
createInvoice()  // Exception historique
```

### ❌ Incorrect
```ts
createClient()  // Conflit avec Supabase, Next.js cache, etc.
```

## 📦 Exports Disponibles

### `@/app/client-actions` (Fichier dédié)
- `createClientAction(client: Client)`
- `updateClientAction(client: Client)`

### `@/app/actions` (Fichier principal)
**User Management**
- `registerUser()`, `loginUser()`, `getDefault User()`, `updateUser()`, `upsertUser()`
- `fetchAllUsers()`, `fetchUserById()`, `getCurrentUser()`, `markHistoryAsRead()`

**Societe**
- `fetchSocietes()`, `getSociete()`, `createSociete()`, `updateSociete()`

**Client Management**
- `fetchClients()`, `createClientAction()`, `updateClientAction()`

**Invoices**
- `fetchInvoices()`, `fetchInvoicesLite()`, `fetchInvoiceDetails()`
- `createInvoice()`, `updateInvoice()`, `markInvoiceAsSent()`, `markInvoiceAsDownloaded()`
- `toggleInvoiceLock()`, `importInvoice()`

**Quotes**
- `fetchQuotes()`, `fetchQuotesLite()`, `fetchQuoteDetails()`
- `createQuote()`, `updateQuote()`, `toggleQuoteLock()`, `convertQuoteToInvoice()`, `importQuote()`

**Products**
- `fetchProducts()`, `createProduct()`, `updateProduct()`

**Utilities**
- `deleteRecord()`, `deleteAllRecords()`, `emptyTrash()`, `permanentlyDeleteRecord()`
- `archiveRecord()`, `unarchiveRecord()`, `restoreRecord()`
- `fetchHistory()`, `createHistoryEntry()`
- `checkDatabaseConnection()`

## 🚨 Boundaries Next.js

### Server Actions (`"use server"`)
- ✅ Fichiers: `actions.ts`, `client-actions.ts`
- ✅ Peuvent être importés dans des composants client
- ❌ Ne doivent PAS exposer de secrets/clés API
- ❌ Ne doivent PAS avoir `"use client"` dans le même fichier

### Import depuis Client Components
```tsx
"use client";
import { createClientAction } from "@/app/client-actions"; // ✅ OK
```

## 🔧 Scripts de Vérification

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Build (obligatoire avant merge)
```bash
npm run build
```

## 🐛 Troubleshooting Turbopack Cache

Si erreur "Export X doesn't exist":

```bash
# 1. Arrêter le serveur (Ctrl+C)
# 2. Nettoyer les caches
rm -rf .next node_modules/.cache
# 3. Relancer
npm run dev
```

Si le problème persiste:
- Vérifier que l'export existe réellement dans le fichier source
- Vérifier qu'il n'y a pas de conflits de noms
- Vérifier la syntaxe TypeScript (pas d'erreurs de compilation)

## ✨ Best Practices

1. **Nommer clairement**: Suffixe `-Action` pour différencier des fonctions client
2. **Un fichier = un domaine**: Séparer les actions par domaine métier si le fichier dépasse 2000 lignes
3. **TypeScript strict**: Toujours typer les arguments et retours
4. **Validation**: Valider les données côté serveur (jamais faire confiance au client)
5. **Logging**: Utiliser `createHistoryEntry()` pour tracer les actions importantes

## 📝 Historique des Changements

- **2025-12-25**: Renommage `createClient` → `createClientAction` pour éviter collision Turbopack
- **Initial**: Séparation `client-actions.ts` pour isoler les actions clients
