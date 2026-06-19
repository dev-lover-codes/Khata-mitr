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

- [x] **Step 16**: Redefine Gemini client configuration and tool signatures (`add_transaction`, `get_balance`, `get_ledger_history`, `get_weather`, and `calculate`) in `src/lib/gemini.ts`.
- [x] **Step 17**: Create the core AI serverless handler at `src/app/api/assistant/route.ts` with full database relationship lookup and tool execution callbacks.
- [x] **Step 18**: Ensure both the user message and assistant reply are logged inside the `chat_logs` table using the user's UUID.
- [x] **Step 19**: Create a floating chat UI widget `src/components/ChatAssistant.tsx` that loads previous message histories and communicates with the assistant endpoint.
- [x] **Step 20**: Wire the `ChatAssistant` component inside `src/app/page.tsx` for authenticated users.
- [x] **Step 21**: Run ESLint validation checks and verify error-free compilation of the codebase.
- [x] **Step 22**: Create `/src/app/retailer/page.tsx` to render the Retailer Dashboard.
- [x] **Step 23**: Create `/src/app/customer/page.tsx` to render the Customer Dashboard.
- [x] **Step 24**: Update `/src/app/page.tsx` to redirect authenticated users to their corresponding dashboard route.
- [x] **Step 25**: Update `/src/app/setup-profile/page.tsx` to redirect users to their corresponding dashboard route.
- [x] **Step 26**: Update the callback handler `/src/app/auth/callback/route.ts` to redirect to `/retailer` or `/customer`.
- [x] **Step 27**: Verify compilation and run lint checks.

