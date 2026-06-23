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
- [x] **Step 28**: Create a GitHub Actions workflow file `.github/workflows/ci.yml` to run lint and build verification on push/pull request.
- [x] **Step 29**: Generate a professional, modern crimson red and gold App Icon / Favicon (featuring traditional Indian ledger book motif and AI sparkles). Process and place files (`icon.png`, `favicon.ico`) in `/src/app` and `/public` directories for Next.js asset optimization.
- [x] **Step 30**: Create Next.js proxy file at `src/proxy.ts` to ensure session persistence and token refresh are properly executed on every route request.
- [x] **Step 31**: Update the `signUpWithEmail` server action in `src/app/actions/auth.ts` to use `createAdminClient` to register new users with `email_confirm: true` by default, bypassing email verification loops in the test/development environment.
- [x] **Step 32**: Update the login handler in `src/app/page.tsx` to sign in on the client side using the browser Supabase client (or call `supabase.auth.setSession`), ensuring immediate auth listener execution and dashboard redirects.
- [x] **Step 33**: Resolve the UX issue where the account creation success message is stored in the `authError` state and displayed as a red error alert. Introduce a new `authSuccess` state to handle success messages and render them as an elegant green notification banner with a Sparkles icon.
- [x] **Step 34**: Update `src/lib/translations.ts` to add translation strings for Forgot Password and Reset Password features in English and Hindi.
- [x] **Step 35**: Update `src/app/auth/callback/route.ts` to handle the `next` search parameter and redirect the user accordingly.
- [x] **Step 36**: Modify `src/app/page.tsx` to handle Google Sign-in on the client side using the browser Supabase client to fix the `NEXT_REDIRECT` error display.
- [x] **Step 37**: Implement the Forgot Password form toggle and email link request handler in `src/app/page.tsx`.
- [x] **Step 38**: Create the bilingual `/src/app/reset-password/page.tsx` page to handle password updating.
- [x] **Step 39**: Extend the Supabase schema with migrations for `inventory` and `stationery_sales` tables including RLS policies and an auto-decrement stock trigger function.
- [x] **Step 40**: Create `src/app/actions/stationery.ts` with helper actions to fetch inventory, check low stock, add items, and record counter sales.
- [x] **Step 41**: Register the `add_inventory_item` tool definition in `src/lib/gemini.ts` and wire its execution in `src/app/api/assistant/route.ts`.
- [x] **Step 42**: Create the bilingual frontend panel `src/components/StationeryManager.tsx` with inventory tracking, low-stock alerts, and a counter sales billing form.
- [x] **Step 43**: Add the Stationery management section as a tab/panel in `src/components/RetailerDashboard.tsx` for retailers.
- [x] **Step 44**: Configure local environments (`.env.local` and `.env.production.local`) and all Vercel environment targets (`Production`, `Preview`, `Development`) with the new Gemini API Key (`[REDACTED_GEMINI_API_KEY]`), ensuring build and lint pass successfully.
- [x] **Step 45**: Create `/src/app/login/page.tsx` client component featuring beautiful dark visual styling, logo acronym box, credentials inputs, and integration with `supabase.auth.signInWithPassword`.
- [x] **Step 46**: Create `/src/app/signup/page.tsx` client component featuring matching styling, user metadata field, and integration with `supabase.auth.signUp`.
- [x] **Step 47**: Perform automated build and lint checks (`npm run lint` and checking compilation).
- [x] **Step 48**: Execute Git commit and push command to synchronize changes.
- [x] **Step 49**: Refactor backend assistant API controller `/src/app/api/assistant/route.ts` to support dual-mode (Text + Voice) and bilingually instruct Gemini with the specified 3-step operational mandate.
- [x] **Step 50**: Create the frontend `src/components/ChatInput.tsx` client component featuring a Mode Switcher toggle, auto-resizing textarea, native MediaRecorder voice capturing, and standardized payload dispatching.
- [x] **Step 51**: Integrate `ChatInput.tsx` into `src/components/ChatAssistant.tsx` to replace the old footer input and verify bilinguality / speech synthesis options.
- [x] **Step 52**: Verify build compilation and run linting checks.
- [x] **Step 53**: Commit and push the changes to Git.
- [x] **Step 54**: Fix backward compatibility issue in `/api/assistant/route.ts` where older cached clients might send `message` payload directly instead of `inputType`, preventing `"Invalid option: expected one of 'text'|'audio'"` error.
- [x] **Step 55**: Add "Confirm Password" input field to registration page `/src/app/signup/page.tsx` with proper layout order and validation check.
- [x] **Step 56**: Execute linting, compilation test, stage, commit and push changes.
- [x] **Step 57**: Update the embedded signup panel on the main landing page `src/app/page.tsx` (when `isSignUp` is true) to include the redesigned registration layout: Full Name, Email, Password, Confirm Password, and Terms & Conditions.
- [x] **Step 58**: Run lint checks and build verification to ensure no errors.
- [x] **Step 59**: Execute Git commit and push command.
- [x] **Step 60**: Solve language toggle bug on Customer and Retailer dashboard pages where selecting English did not translate dashboard elements. Pass active `language` state from parent page to CustomerDashboard, RetailerDashboard, and ChatAssistant.
- [x] **Step 61**: Run ESLint validation checks and verify error-free compilation of the codebase.
- [x] **Step 62**: Commit and push the changes to Git.
- [x] **Step 63**: Remediate the invalid/expired Gemini API Key error by guiding the user to provide a valid key, updating it in the local `.env.local` file and verifying its status.
- [x] **Step 64**: Update `GEMINI_API_KEY` across all three Vercel environments (Production, Preview, Development) via Vercel CLI and redeploy to production. Verified live endpoint responds correctly with no API key errors.
- [x] **Step 65**: Implement autonomous agent mode loop in assistant and voice-assistant API routes to enable end-to-end multi-turn tool chaining. Use the exact new `create_customer_and_link` handler definition and handler logic to register and link new customers via Supabase Auth Admin.
- [x] **Step 66**: Fix systemInstruction prompts in both endpoints to enforce aggressive, autonomous action-first agent behaviors.
- [x] **Step 67**: Verify build and linting checks and commit changes to git.
- [x] **Step 68**: Hook up `khata-agent-action` CustomEvent listener in ChatAssistant.tsx and RetailerDashboard.tsx to sync and refresh customer relationships.
- [x] **Step 69**: Implement state `agentFeed` inside RetailerDashboard to maintain and render the floating action feed banner detailing AI agent responses.
- [x] **Step 70**: Enforce environment variables check for `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` at the entry points of both assistant and voice-assistant POST APIs.
- [x] **Step 71**: Define and register `findCustomerTool` (`find_customer`) in `src/lib/gemini.ts`.
- [x] **Step 72**: Implement the backend handler for `find_customer` inside both text (`/api/assistant`) and voice (`/api/voice-assistant`) endpoints.
- [x] **Step 73**: Enforce rule in systemInstruction to ALWAYS search using `find_customer` first before calling `create_customer_and_link` or `add_transaction` when a customer name is mentioned.
- [x] **Step 74**: Run compiler, linter, and build verification checks to guarantee error-free code execution.


