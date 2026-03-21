# BizBuz (ביזבוז) — Family Financial Tracker

A multi-tenant SaaS family financial tracker for the Israeli market. Track spending, savings, investments, and loans across shared family accounts with automatic transaction categorization.

## Tech Stack

- **Frontend:** Vue 3 + TypeScript + Vite
- **State:** Pinia (Setup Stores)
- **Styling:** Tailwind CSS 4 + PrimeVue (unstyled)
- **Charts:** Chart.js via vue-chartjs
- **i18n:** vue-i18n (Hebrew + English, RTL support)
- **Backend:** Firebase (Firestore, Auth, Cloud Functions)
- **Ingestion:** External scraper → Cloud Function `/ingest` endpoint

## Getting Started

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
```

## Cloud Functions

```bash
cd functions/
npm install
npm run build
npm test
firebase emulators:start    # Local development
firebase deploy --only functions
```

## Deployment

```bash
npm run build
firebase deploy
```

## Project Structure

```
src/
  types/          # TypeScript interfaces
  stores/         # Pinia stores (auth, family, transactions, preferences, savings, ui)
  composables/    # Shared logic (formatters, billing cycle, categories, tracker)
  services/       # Firebase service layer
  views/          # Page components (Home, Spendings, Savings, Investments, Loans, Settings)
  components/     # Reusable UI components
  i18n/           # Locale messages (en/he)
  router/         # Vue Router with auth guards
functions/        # Firebase Cloud Functions (Node.js/TypeScript)
```

## License

See [LICENSE](LICENSE) for details.
