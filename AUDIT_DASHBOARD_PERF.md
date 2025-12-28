# Audit de Performance - Dashboard (Index)

## Problèmes Identifiés

### 1. DataProvider - Fetch Client Massif au Montage
**Impact:** Tous les clients/produits/factures sont chargés côté client même si le serveur fournit déjà les données nécessaires.
**Solution:** Rendre DataProvider "lazy" ou désactiver le fetch automatique quand initialData est fourni par le serveur.

### 2. Charts - Chargement Dynamique Sans SSR
**Impact:** Les charts (`InvoiceStatusChart`, `QuoteStatusChart`) utilisent `ssr: false`, ajoutant un délai supplémentaire.
**Solution:** Pré-calculer les données de graphique côté serveur et utiliser des composants de chart compatibles SSR.

### 3. fetchDashboardMetrics - Multiple Requêtes Prisma Séquentielles
**Impact:** 4 requêtes DB distinctes (totalRevenue, counts, overdue, dueSoon) non optimisées.
**Solution:** Fusion en une seule requête SQL brute ou utilisation de `$transaction` avec optimisation.

### 4. Date Formatting Lourd (date-fns)
**Impact:** Imports de 6 fonctions date-fns dans DashboardContent.
**Solution:** Utiliser `Intl.DateTimeFormat` natif ou lazy-load date-fns uniquement quand nécessaire.

### 5. Fallback Client-Side - Logique Redondante
**Impact:** `displayInvoices` et `displayQuotes` font du slicing conditionnel, recalculé à chaque render.
**Solution:** Utiliser `useMemo` pour mémoriser les résultats.

### 6. Prisma Connection - Cold Start
**Impact:** Connexion Prisma lente au premier load (dev mode).
**Solution:** Activer connection pooling ou utiliser `prisma.$connect()` au startup de l'app.

### 7. getCurrentUser - Cookie Parsing à Chaque Request
**Impact:** `fetchDashboardData` lit les cookies à chaque fois (overhead).
**Solution:** Middleware pour parser le cookie une fois et l'injecter dans le contexte.

### 8. Absence de Cache HTTP
**Impact:** Aucun header de cache sur `fetchDashboardData`.
**Solution:** Ajouter `revalidate` ou utiliser `unstable_cache` de Next.js.

### 9. useEffect Dependencies - Trop d'Exécutions
**Impact:** L'effet se déclenche sur `societe?.id, dateRange, customStart, customEnd`, même quand inutile.
**Solution:** Comparer les valeurs précédentes avec `useRef` pour éviter les re-fetch redondants.

### 10. LocalStorage - Opérations Synchrones Bloquantes
**Impact:** `dataService.initialize()` lit/écrit localStorage de manière synchrone.
**Solution:** Différer les opérations localStorage avec `requestIdleCallback` ou les rendre asynchrones.

## Recommandations par Priorité

**P0 (Critique):**
- #3: Optimiser fetchDashboardMetrics (requêtes DB)
- #1: Désactiver fetch DataProvider si données serveur présentes

**P1 (Important):**
- #8: Ajouter cache HTTP/ISR
- #6: Connection pooling Prisma

**P2 (Amélioration):**
- #2: SSR Charts
- #5: useMemo pour displayInvoices/Quotes
- #9: Optimiser useEffect dependencies

**P3 (Nice-to-have):**
- #4: Remplacer date-fns par Intl
- #7: Middleware cookie parsing
- #10: Async localStorage
