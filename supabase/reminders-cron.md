# Supabase pg_cron + Edge Function Reminder System

This guide explains how to set up the automated reminder system for **KhataMitra (खातामित्र)** using Supabase's `pg_cron` database extension and Supabase Edge Functions.

---

## Architecture Overview

```mermaid
graph LR
    Cron[pg_cron Job] -->|HTTP POST every minute| EdgeFn[Supabase Edge Function]
    EdgeFn -->|Fetch due reminders| DB[(Supabase Postgres)]
    EdgeFn -->|Send WhatsApp/SMS| Gateway[Twilio / WhatsApp API]
    EdgeFn -->|Update Status to 'sent'| DB
```

---

## Step 1: Enable `pg_cron` and `pg_net` in Supabase

Run the following SQL commands in your Supabase SQL Editor to enable the scheduling extensions:

```sql
-- Enable the extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

---

## Step 2: Write & Deploy the Edge Function (`send-reminders`)

Create a new Supabase Edge Function named `send-reminders`.

### Edge Function Code (`supabase/functions/send-reminders/index.ts`)

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

serve(async (req) => {
  try {
    // 1. Initialize Supabase Admin Client using service role key (bypass RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // 2. Fetch pending reminders whose due dates have passed
    const { data: dueReminders, error: fetchError } = await supabase
      .from('reminders')
      .select(`
        id,
        message,
        due_date,
        retailer:profiles!retailer_id(full_name, shop_name),
        customer:profiles!customer_id(full_name, phone)
      `)
      .eq('status', 'pending')
      .lte('due_date', new Date().toISOString());

    if (fetchError) throw fetchError;
    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ message: "No reminders due." }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    const results = [];

    // 3. Loop through and dispatch alerts
    for (const reminder of dueReminders) {
      const recipientPhone = reminder.customer.phone;
      const smsBody = `Pranam ${reminder.customer.full_name}! Reminder from ${reminder.retailer.shop_name || reminder.retailer.full_name}: ${reminder.message}`;

      try {
        // Example: Sending notification using WhatsApp Cloud API or Twilio
        // Replace with your preferred notification provider integration (Twilio, Gupshup, etc.)
        const response = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + Deno.env.get("TWILIO_ACCOUNT_SID") + "/Messages.json", {
          method: "POST",
          headers: {
            "Authorization": "Basic " + btoa(Deno.env.get("TWILIO_ACCOUNT_SID") + ":" + Deno.env.get("TWILIO_AUTH_TOKEN")),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: recipientPhone,
            From: Deno.env.get("TWILIO_PHONE_NUMBER")!,
            Body: smsBody,
          }),
        });

        if (response.ok) {
          // Update status to 'sent'
          await supabase
            .from('reminders')
            .update({ status: 'sent' })
            .eq('id', reminder.id);
          
          results.push({ id: reminder.id, status: "sent" });
        } else {
          throw new Error(await response.text());
        }
      } catch (err: any) {
        console.error(`Failed to send reminder ${reminder.id}:`, err.message);
        
        // Update status to 'failed'
        await supabase
          .from('reminders')
          .update({ status: 'failed' })
          .eq('id', reminder.id);
          
        results.push({ id: reminder.id, status: "failed", error: err.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, details: results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
})
```

Deploy the function using the Supabase CLI:
```bash
supabase functions deploy send-reminders
```

---

## Step 3: Schedule the Cron Job

Configure `pg_cron` to make an HTTP POST request to the Edge Function every minute. Run this SQL in your Supabase SQL Editor:

```sql
-- Schedule the HTTP trigger using pg_cron to fire every 1 minute
SELECT cron.schedule(
  'send-due-reminders-job',
  '* * * * *', -- Standard cron syntax for "every minute"
  $$
  SELECT net.http_post(
    url := 'https://your-project-ref.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_ANON_OR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Management Commands:

* **View running cron jobs**:
  ```sql
  SELECT * FROM cron.job;
  ```
* **View execution history/logs**:
  ```sql
  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;
  ```
* **Unschedule a job**:
  ```sql
  SELECT cron.unschedule('send-due-reminders-job');
  ```
