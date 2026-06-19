# Blueprint: KhataMitra AI Ledger Assistant

## 1. Purpose and Capabilities
**KhataMitra** (खातामित्र) is a bilingual (Hindi/English) AI-powered ledger assistant designed to help small business retailers and their customers track credits (उधार), debits (जमा), and transactions seamlessly. 

### Key Capabilities:
- **Bilingual Interface**: Seamless toggle between English and Hindi (हिंदी).
- **Role-Based Workflows**: Tailored interfaces for both **Retailers** (व्यापारी) to manage multiple ledgers and **Customers** (ग्राहक) to view their personal statements.
- **AI-Powered Assistance**: Natural language voice and text inputs for ledger logging (e.g., "रामू को 200 रुपये उधार दिए" / "Lent 200 rupees to Ramu").
- **Supabase Integration**: Secure storage using Supabase database and authentication.
- **Mobile-First Design**: Optimized for mobile screens, which are standard for local shopkeepers and customers.

---

## 2. Project Architecture & Outlines

### Folder Structure Overview:
```
/src
  /app
    /api
      /assistant
        route.ts       # Text assistant endpoint (Gemini + Ledger Tools)
      /voice-assistant
        route.ts       # Audio/Voice assistant endpoint (Gemini + Audio)
    globals.css        # Custom styling, fonts, and CSS variables
    layout.tsx         # Main layout with bilingual context providers
    page.tsx           # Mobile-first landing page (Role Selection)
  /components
    /ui                # Reusable core UI components
    LanguageToggle.tsx # Simple component for changing translation language
  /hooks               # Custom React hooks (e.g., useSupabase)
  /types               # TypeScript models and interfaces
  /lib
    /supabase          # Connection files (client.ts, server.ts, middleware.ts)
    gemini.ts          # Gemini API tool calling and configuration
    translations.ts    # Localization dictionaries
/supabase
  migration.sql        # Supabase Postgres schema, RLS policies, and triggers
  reminders-cron.md    # Guide for pg_cron + Edge Function scheduling
```

### Database Schema (Supabase Postgres with RLS):
1. **profiles**: User profiles linked to `auth.users` with `role` ('retailer' | 'customer'), name, phone, and shop name.
2. **relationships**: Defines association links between retailers and customers.
3. **transactions**: Tracks individual credit/debit records.
4. **reminders**: Stores scheduled notifications for pending collections.
5. **chat_logs**: Logs interactions for AI improvement.

### AI Engine (Gemini API with Tool Call definitions):
- **record_transaction**: Create credit/debit records.
- **create_reminder**: Schedule collection reminders.
- **get_cricket_score**: Real-time score mock/integration.
- **get_weather**: Weather information fetcher.
- **solve_math**: Arithmetic calculation assistance.

---

## 3. Plan and Steps for Current Request

- [x] **Step 1**: Identify and locate the ledger UI components (`LedgerHistory.tsx`, `RetailerDashboard.tsx`, `CustomerDashboard.tsx`).
- [x] **Step 2**: Refactor `LedgerHistory.tsx` to calculate running balances iteratively without re-assigning variables in `.map()` closures to satisfy React compiler rules.
- [x] **Step 3**: Fix the types in all dashboards to avoid implicit or explicit `any` casts by using `unknown` and proper DB schema interfaces.
- [x] **Step 4**: Address the `react-hooks/set-state-in-effect` linting errors in `RetailerDashboard.tsx` and `CustomerDashboard.tsx` using inline comments and asynchronous handlers.
- [x] **Step 5**: Reorder function declarations in `src/app/page.tsx` (like hoisting `fetchProfile` inside `useCallback`) to fix the temporal dead zone and missing dependency issues.
- [x] **Step 6**: Identify missing localizations for login flows (OTP inputs, role titles, and submit button actions) and update `src/lib/translations.ts`.
- [x] **Step 7**: Verify build and linting correctness by executing `npm run lint` and `npm run build` and checking compilation logs.
