# BizBuz Vue 3 Migration — Status & Handoff Guide

## Overview

BizBuz (ביזבוז) is a multi-tenant SaaS family financial tracker for the Israeli market. The frontend was migrated from Flutter/Dart to Vue 3 + TypeScript. The Firebase backend (Firestore, Cloud Functions, Auth) is unchanged.

**Branch:** `vue-migration` on `github.com:Mitnitsky/bizbuz`
**Project path:** `bizbuz-vue/` (or clone root on `vue-migration` branch)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Vue 3 (Composition API, `<script setup>`) |
| Language | TypeScript (strict) |
| Build | Vite 8 |
| State | Pinia (setup stores) |
| Styling | Tailwind CSS 4 + PrimeVue (unstyled mode) |
| Charts | Chart.js via vue-chartjs |
| Drag & Drop | vuedraggable@next (SortableJS) |
| i18n | vue-i18n (Hebrew + English, RTL) |
| Dates | date-fns |
| Validation | VeeValidate + Zod (installed, not yet used everywhere) |
| Backend | Firebase v10 SDK (Firestore, Auth) |
| Cloud Functions | Node.js/TypeScript (in `functions/`) |

## Firebase Config

- **Project:** bizbuz-3a473
- **Test user:** `test123@test.com` / `test123@test.com` (email is both user and pass)
- **Test family ID:** `zEE5p7TvIFnuIdgpU3Ix`
- **653 test transactions** seeded (run `cd functions && node seed.js` to re-seed)

## Project Structure

```
src/
├── types/index.ts            # All TypeScript interfaces
├── firebase.ts               # Firebase init (config, db, auth exports)
├── main.ts                   # App entry (Pinia, Router, i18n, PrimeVue)
├── assets/main.css           # Tailwind + base styles + dark mode + RTL
│
├── stores/                   # Pinia setup stores
│   ├── auth.ts               # Firebase Auth state, login/register/logout
│   ├── family.ts             # Family doc + family settings + member names
│   ├── transactions.ts       # Real-time transactions, cycle filtering, inbox
│   ├── preferences.ts        # User preferences (locale, theme, dashboard order)
│   ├── savings.ts            # Savings entries (liquid/locked)
│   └── ui.ts                 # UI state (ownerFilter, cycleOffset)
│
├── services/firestore.ts     # All Firestore CRUD + real-time listeners (25+ methods)
│
├── composables/
│   ├── useBillingCycle.ts    # Cycle date range calculation
│   ├── useCategories.ts      # 26 Hebrew categories, English map, display helper
│   ├── useFormatters.ts      # Currency (₪) and date formatting
│   └── useTracker.ts         # Tracker fields extraction + days-remaining calc
│
├── i18n/
│   ├── en.ts                 # English locale (~100+ keys)
│   ├── he.ts                 # Hebrew locale (~100+ keys)
│   └── index.ts              # i18n instance setup
│
├── router/index.ts           # Vue Router with auth guards
│
├── views/                    # Page-level components
│   ├── HomeView.vue          # Dashboard with 6 reorderable tiles
│   ├── SpendingsView.vue     # Inbox + category cards (wide: split panel, narrow: tabs)
│   ├── SavingsView.vue       # Liquid/locked savings with trackers
│   ├── InvestmentsView.vue   # Investment entries with trackers
│   ├── LoansView.vue         # Loan entries with trackers
│   ├── SettingsView.vue      # Full settings (billing, budgets, theme, locale, etc.)
│   ├── LoginView.vue         # Email/password login + register
│   └── OnboardingView.vue    # Create family or join via invite code
│
├── components/
│   ├── CycleSelector.vue     # Shared ‹/› cycle navigator (used on Home)
│   ├── OwnerFilterChip.vue   # All/UserA/UserB segmented filter
│   ├── TrackerDialog.vue     # Shared tracker config modal (none/once/interval)
│   │
│   ├── dashboard/
│   │   ├── CycleSpendTile.vue
│   │   ├── CategoryPieTile.vue
│   │   ├── BudgetRemainingTile.vue
│   │   ├── InstallmentsTile.vue
│   │   ├── BudgetsTile.vue
│   │   └── TrackersTile.vue
│   │
│   ├── spendings/
│   │   ├── CycleSelector.vue           # Spendings-specific cycle selector
│   │   ├── InboxPanel.vue              # Collapsible inbox with transaction list
│   │   ├── CategoryCard.vue            # Drop target + expand/collapse + budget bar
│   │   ├── TransactionListItem.vue     # Single transaction row (draggable)
│   │   ├── TransactionDetailDialog.vue # Full detail + inline edit
│   │   ├── SplitDialog.vue             # Split transaction into parts
│   │   ├── CreateRuleDialog.vue        # Auto-categorization rule builder
│   │   └── AddTransactionDialog.vue    # Manual transaction form
│   │
│   ├── savings/
│   │   ├── SavingsEntryCard.vue
│   │   └── AddSavingsDialog.vue
│   │
│   ├── investments/
│   │   ├── InvestmentCard.vue
│   │   ├── InvestmentSummary.vue
│   │   └── AddInvestmentDialog.vue
│   │
│   └── loans/
│       ├── LoanCard.vue
│       ├── LoanSummary.vue
│       └── AddLoanDialog.vue
│
functions/                    # Cloud Functions (unchanged from Flutter era)
├── src/index.ts              # /ingest HTTP endpoint
├── src/rules-engine.ts       # Auto-categorization rules engine
├── seed.js                   # Test data seeder script
└── package.json
```

## Feature Migration Status

### ✅ Fully Migrated (code complete, builds clean)

| Feature | Files | Notes |
|---------|-------|-------|
| **Auth** | `auth.ts`, `LoginView`, `OnboardingView` | Login, register, logout, onAuthStateChanged |
| **Family management** | `family.ts`, `OnboardingView` | Create family, join via invite code |
| **App shell** | `App.vue` | Sidebar (wide) + bottom tabs (narrow), auth gating, theme, RTL |
| **Home dashboard** | `HomeView`, 6 tile components | Reorderable via vuedraggable, persisted to Firestore |
| **Spendings screen** | `SpendingsView`, 8 sub-components | Inbox, category cards, drag-to-categorize, detail/split/rule dialogs |
| **Savings screen** | `SavingsView`, `SavingsEntryCard`, `AddSavingsDialog` | Liquid/locked grouping, tracker chips |
| **Investments screen** | `InvestmentsView`, 3 sub-components | Summary card, add dialog, tracker support |
| **Loans screen** | `LoansView`, 3 sub-components | Summary card, add dialog, tracker support |
| **Settings screen** | `SettingsView` | Billing cycle, budgets, payment methods, category aliases, theme, locale |
| **Tracker system** | `TrackerDialog`, `useTracker` | Days-since-last-update for savings/investments/loans |
| **i18n** | `en.ts`, `he.ts` | Full Hebrew + English, RTL auto-switch |
| **Dark mode** | `App.vue`, `main.css` | System/light/dark toggle, persisted in user prefs |
| **Billing cycles** | `useBillingCycle.ts` | Configurable start day, cycle navigation |
| **Category system** | `useCategories.ts` | 26 Hebrew categories (20 scraper + 4 kept + 2 system) |
| **Cloud Functions** | `functions/src/` | Ingest endpoint, rules engine (unchanged) |
| **Firestore indexes** | `firestore.indexes.json` | Deployed to production |

### 🐛 Known Bugs (needs fixing)

1. **Spendings page shows "no transactions yet"**
   - Transactions ARE loading (655 confirmed in console)
   - `cycleTransactions` computed filters by billing cycle date range
   - Debug logging is in place in `stores/transactions.ts` (lines 25-40)
   - Likely cause: cycle range mismatch or `familySettings.cycleStartDay` not loaded when computed first runs
   - **Debug output needed:** Check browser console for `[transactions store] cycle range:` and `sample dates:` lines
   - Test data spans 2025-03 to 2026-03 (only 16 txns in March 2026)
   - The cycle selector ‹/› should navigate to months with data

2. **"Missing or insufficient permissions" on other users' docs**
   - **Fixed** with try/catch in `stores/family.ts` `bindFamily()` — falls back to UID prefix
   - Firestore rule: `/users/{userId}` only allows read by that user
   - Long-term fix: store member display names on the family doc itself

3. **Firestore composite index still building**
   - Index `hidden_from_ui ASC + date DESC` was deployed but may still be building
   - Current workaround: `onTransactions()` in `services/firestore.ts` does NOT use `orderBy` — sorts client-side instead
   - Once index is ready, can add `orderBy('date', 'desc')` back for efficiency

### 🔧 Needs Polish / Not Yet Tested

1. **Drag-to-categorize on spendings** — Code exists in `CategoryCard.vue` (HTML5 drop target) and `TransactionListItem.vue` (draggable), but untested with real data
2. **Split transaction flow** — `SplitDialog.vue` complete but untested end-to-end
3. **Create rule flow** — `CreateRuleDialog.vue` complete but untested
4. **VeeValidate/Zod** — Installed but not wired into all forms (currently using basic HTML validation)
5. **RTL layout** — CSS `[dir="rtl"]` rules in `main.css`, auto-switch works, but visual pass needed for all screens in Hebrew
6. **Dark mode** — All components use `dark:` variants, but visual pass needed for consistency
7. **Responsive layout** — Basic wide/narrow breakpoint at 800px, may need refinement
8. **Chunk size** — `vue-i18n` bundle is 546KB gzipped — consider lazy-loading locales
9. **HelloWorld.vue, style.css, hero.png, vite.svg, vue.svg** — Vite scaffold leftovers, safe to delete

### 📋 Future Work (not started)

1. **Export to CSV** — Was planned but not implemented in Vue
2. **Notifications** — Tracker overdue alerts (visual only, no push)
3. **PWA support** — Service worker, manifest, offline capability
4. **Tests** — No frontend tests yet (Cloud Function tests exist in `functions/`)
5. **CI/CD** — No GitHub Actions workflow yet
6. **Firebase Hosting deployment** — `firebase.json` has hosting config pointing to `dist/`, not yet deployed

## Firestore Schema (unchanged)

### Collections under `families/{familyId}/`

| Collection | Key Fields |
|------------|-----------|
| `transactions` | `date`, `processedDate`, `chargedAmount`, `originalAmount`, `description`, `category`, `owner_tag` (userA/userB/shared), `status` (pending_categorization/auto_categorized/categorized), `source` (moneyman/manual), `user_locked`, `is_split`, `hidden_from_ui`, `installments.number/total` |
| `savings` | `name`, `amount`, `savings_type` (liquid/locked), `firm_name`, `last_updated`, `tracker_type`, `tracker_date`, `tracker_interval_days` |
| `investments` | `name`, `invested_amount`, `current_value`, `last_updated`, tracker fields |
| `loans` | `name`, `principal`, `remaining`, `last_updated`, tracker fields |
| `rules` | `conditions[]` ({field, operator, value}), `action_category`, `action_override_description` |
| `family_settings/default` | `cycle_start_day`, `category_budgets{}`, `payment_method_labels{}`, `category_name_overrides{}`, `category_order[]` |
| `user_preferences/{uid}` | `dashboard_tile_order[]`, `locale`, `show_owner_filter`, `show_payment_source`, `theme_mode` |

### Top-level collections

| Collection | Purpose |
|------------|---------|
| `users/{uid}` | `uid`, `email`, `family_id`, `display_name` |
| `families/{familyId}` | `name`, `member_uids[]`, `created_by` |
| `ingestion_errors` | Dead letter queue for malformed ingest payloads |

## Key Patterns & Gotchas

1. **Idempotent ingestion** — `uniqueId` is Firestore doc ID, ingest uses `set(merge: true)`
2. **Tombstone pattern** — Split transactions: original gets `is_split: true, hidden_from_ui: true`, children get `_split_A/B` suffix IDs
3. **`user_locked: true`** — Prevents scraper from overwriting manual edits
4. **`hidden_from_ui: false`** — Must be in every transaction query to exclude tombstones
5. **Transfer category (`העברה`)** — Excluded from all spend totals, charts, and budgets
6. **Billing cycle** — `cycle_start_day: -1` means last day of month; `1` means 1st of month
7. **Owner tags** — `userA` maps to first member in `member_uids[]`, `userB` to second (index-based, fragile)
8. **Category keys** — Hebrew strings are canonical in Firestore (e.g., `מזון ומשקאות`), English translations in `useCategories.ts`

## Accessing the Flutter Source (for feature comparison)

The original Flutter/Dart frontend lives on the `main` branch of the same repo. Use `git worktree` to have both codebases side-by-side without cloning twice:

```bash
# From the Vue project root (vue-migration branch):
git worktree add ../bizbuz-flutter main
```

This creates `../bizbuz-flutter/` checked out at `main` (the Flutter code), while your current directory stays on `vue-migration`. Both share the same `.git` history.

### Flutter project layout (key directories for reference)

```
bizbuz-flutter/
├── lib/
│   ├── main.dart                    # App entry, theme, auth gate
│   ├── models/                      # Freezed data models
│   │   ├── user_preferences.dart    # UserPreferences (themeMode, locale, etc.)
│   │   ├── family_settings.dart     # FamilySettings (cycleStartDay, budgets, etc.)
│   │   └── savings_entry.dart       # SavingsEntry (with tracker fields)
│   ├── providers/                   # Riverpod providers
│   ├── screens/
│   │   ├── home/home_screen.dart    # Dashboard with pie chart, tiles, trackers
│   │   ├── spendings/spendings_screen.dart  # Category cards, inbox, drag & drop
│   │   ├── savings/savings_screen.dart
│   │   ├── investments/investments_screen.dart
│   │   ├── loans/loans_screen.dart
│   │   └── settings/settings_screen.dart
│   ├── services/
│   │   └── firestore_service.dart   # All Firestore CRUD methods
│   ├── utils/
│   │   ├── categories.dart          # kCategories list (26 items)
│   │   ├── formatters.dart          # Currency/date formatting
│   │   └── locale.dart              # i18n strings, theme provider
│   └── widgets/
│       └── tracker_helpers.dart     # Tracker chip, dialog, calculations
├── functions/                       # Cloud Functions (same as Vue project)
├── pubspec.yaml                     # Flutter dependencies
└── transactions_test.txt            # Test transaction data (653 items)
```

### Useful comparison commands

```bash
# View Flutter categories (canonical list)
grep -A 2 "kCategories" ../bizbuz-flutter/lib/utils/categories.dart

# View Flutter Firestore service methods
grep "Future<" ../bizbuz-flutter/lib/services/firestore_service.dart

# View Flutter locale strings
grep "'" ../bizbuz-flutter/lib/utils/locale.dart | head -60

# Compare feature by feature
diff <(grep -r "class.*Screen" ../bizbuz-flutter/lib/screens/) <(ls src/views/)
```

### Cleanup when done

```bash
# Remove the worktree (does not delete the branch)
git worktree remove ../bizbuz-flutter
```

## Commands

```bash
# Dev
npm install && npm run dev          # Start at localhost:5173

# Build
npm run build                       # Production build → dist/

# Seed test data
cd functions && npm install && node seed.js

# Deploy
npm run build && firebase deploy    # Full deploy (hosting + functions + rules + indexes)
firebase deploy --only hosting      # Just frontend
firebase deploy --only functions    # Just Cloud Functions

# Cloud Functions dev
cd functions && npm run build && npm test
```
