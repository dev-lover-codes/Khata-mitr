# KhataMitra (खातामित्र) — Bilingual AI-Powered Ledger Assistant

**KhataMitra (खातामित्र)** is a modern, mobile-responsive, voice-enabled financial ledger assistant tailored for local Indian shopkeepers (retailers) and their customers. Built on Next.js 16 and Supabase, it leverages Google Gemini 2.5 Flash function-calling capabilities to allow users to record credits, debits, check balances, schedule reminders, and track bookstore/stationery inventory using simple, bilingual (Hindi/English/Hinglish) text or speech commands.

---

## 🚀 Key Features

* **Bilingual UI / UX Toggle**: Fast translation context-switching between Hindi (हिंदी) and English for dashboard components and floating widgets.
* **Role-Based Portals**:
  * **Retailers (व्यापारी)**: Manage multiple customer accounts, record transactions (Udhaar/Jama), view collection stats, schedule payment/call reminders, track shop inventories, and invoice counter sales.
  * **Customers (ग्राहक)**: Securely log in to review current running balances and request detailed transaction statements.
* **Conversational AI Engine (Gemini 2.5)**:
  * **Dual Input Mode**: Type queries or speak directly using the integrated browser audio recording controls.
  * **Multi-Turn Autonomous Actions**: Performs automated database lookups, checks if a customer relationship exists, creates missing accounts, and applies transactions in a single logical loop.
* **Smart Text-To-Speech (TTS)**: Cleans response markdown format strings (headers, code block segments, etc.), expands currency symbols (e.g. ₹ to "rupaye"), chunks texts sequentially to avoid browser speech length cutoffs, and speaks the response with a clear, Indian-accented local voice.
* **Stationery Inventory & Sales Billing**: Monitor low stocks, update cost/selling prices, and generate bills that automatically adjust stocks via triggers.

---

## 🛠️ Technology Stack

* **Frontend**: Next.js 16 (App Router), React 19, Lucide React, CSS/Tailwind
* **Database & Auth**: Supabase PostgreSQL with Row-Level Security (RLS) policies and PL/pgSQL database triggers
* **Conversational AI**: Google GenAI SDK (`@google/genai`), Gemini 2.5 Flash, Custom exponential backoff client for 429 rate limit errors

---

## 📂 Project Architecture

```
/src
  /app                     # Next.js App Router
    /actions               # Server Actions (Auth, Stationery Manager billing)
    /api                   # API endpoints
      /assistant           # Text AI endpoint (Multi-turn tool-calling loop)
      /voice-assistant     # Audio AI endpoint (WAV upload parsing)
      /delete-account      # User self-deletion utility
    /auth                  # Callback authentication handlers
    /customer              # Customer Dashboard view page
    /login                 # Credential sign-in panel
    /reset-password        # Forgotten password reset page
    /retailer              # Retailer Dashboard view page
    /signup                # Registration page with layout confirmations
    globals.css            # Stylesheets, color schemes, and animations
  /components              # Component Library
    ChatAssistant.tsx      # Floating chat interface with clean TTS synthesis
    ChatInput.tsx          # Dual mode text/mic recorder (WAV streaming)
    CustomerDashboard.tsx  # Customer portal panel
    DeleteAccountModal.tsx # Account self-deletion modal dialog
    LanguageToggle.tsx     # Toggle button between English and Hindi
    LedgerHistory.tsx      # Credit/Debit transactions history list
    RetailerDashboard.tsx  # Multi-ledger dashboard interface
    StationeryManager.tsx  # Bookstore inventory and sales panel
  /lib                     # Utility scripts
    gemini.ts              # Gemini client setup, retry decorators, and tool declarations
    translations.ts        # Localization mappings for dual language layout text
```

---

## 💾 Database Schema

The system uses Supabase PostgreSQL with Row-Level Security (RLS) enabled. Core tables include:

1. **`profiles`**: Maps UUID to names, phone numbers, roles (`'retailer' | 'customer'`), and shop metadata.
2. **`relationships`**: Stores links between retailers and their customer list, including a running `balance` sum.
3. **`transactions`**: Credit and debit records linked to relationships. An insert trigger automatically updates the relationship balance.
4. **`reminders`**: Payment and call alerts scheduled for collection dates.
5. **`chat_logs`**: Chat message transcripts between users and the assistant for quality analysis.
6. **`inventory`**: Store stationery products with low stock alerts.
7. **`stationery_sales`**: Ledger billing sales. An insert trigger automatically decrements stock levels in the `inventory` table.

---

## ⚙️ Environment Variables Setup

Create a `.env.local` file in the project's root folder:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-google-gemini-api-key
```

---

## 🏃 Local Installation

1. **Clone the repository and install dependencies**:
   ```bash
   npm install
   ```

2. **Run the local development server**:
   ```bash
   npm run dev
   ```

3. **Check lints and syntax errors**:
   ```bash
   npm run lint
   ```

4. **Verify production builds**:
   ```bash
   npm run build
   ```

---

## 🤖 Conversational Tool Calling Commands

The Gemini model parses conversational instructions and translates them to structured API actions:

* **Find Customer**: Checks if customer name exists first using `find_customer`.
* **Add Transaction**: Logs transaction using `add_transaction` (e.g. *"Raju ko ₹200 ki cheeni udhaar di"*).
* **Get Balance**: Inquires balance status using `get_balance` (e.g. *"Raju ka balance batao"*).
* **Create Account**: Registers a new customer and creates relationships using `create_customer_and_link`.
* **Add Inventory**: Updates product stock quantities using `add_inventory_item`.
