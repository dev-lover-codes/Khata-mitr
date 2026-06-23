import { NextRequest, NextResponse } from 'next/server';
import { khataMitraTools, generateContentWithRetry } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const requestSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  inputType: z.enum(['text', 'audio']),
  textPayload: z.string().optional(),
  audioPayload: z.object({
    mimeType: z.string(),
    base64Data: z.string()
  }).optional(),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })
  ).optional()
});

function pruneHistory(history: { role: 'user' | 'assistant'; content: string }[]) {
  // Keep only the last 4 messages (2 user queries and 2 assistant replies)
  const sliced = history.slice(-4);
  return sliced.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server. Customer creation will not work.' }, { status: 500 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 500 });
  }

  try {
    const body = await req.json();

    // Backward compatibility check for older client layouts
    if (body && !body.inputType && body.message) {
      body.inputType = 'text';
      body.textPayload = body.message;
    }

    const parseResult = requestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId, inputType, textPayload, audioPayload, history = [] } = parseResult.data;

    const supabase = await createClient();

    // 1. Resolve user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    // 2. Fetch active relationships to build the list of context mapping
    let contextInfo = `User ID: ${userId}\n`;
    contextInfo += `User Name: ${profile.full_name}\n`;
    contextInfo += `User Role: ${profile.role}\n`;

    if (profile.role === 'retailer') {
      contextInfo += `Shop/Business Name: ${profile.business_name || 'General Store'}\n`;
      contextInfo += `Associated Customers (Retailer Ledger Relationships):\n`;
      
      const { data: relationships } = await supabase
        .from('relationships')
        .select('customer_id, balance, profiles!customer_id(full_name, phone)')
        .eq('retailer_id', userId);

      if (relationships && relationships.length > 0) {
        relationships.forEach((r) => {
          const customer = r.profiles as unknown as { full_name: string; phone: string | null } | null;
          contextInfo += `- Customer: ${customer?.full_name || 'Unknown'}, ID: ${r.customer_id}, Phone: ${customer?.phone || 'None'}, Running Balance: ₹${r.balance || 0}\n`;
        });
      } else {
        contextInfo += `(No customers found. Retailer has no active ledgers yet.)\n`;
      }
    } else {
      contextInfo += `Associated Retailers (Customer Ledger Relationships):\n`;
      
      const { data: retailerRels } = await supabase
        .from('relationships')
        .select('retailer_id, balance, profiles!retailer_id(full_name, business_name)')
        .eq('customer_id', userId);
      
      if (retailerRels && retailerRels.length > 0) {
        retailerRels.forEach((r) => {
          const retailer = r.profiles as unknown as { full_name: string; business_name: string | null } | null;
          contextInfo += `- Retailer: ${retailer?.full_name || 'Unknown'}, Business: ${retailer?.business_name || 'None'}, ID: ${r.retailer_id}, Balance Owed: ₹${r.balance || 0}\n`;
        });
      } else {
        contextInfo += `(No retailers found. Customer has no active ledger links yet.)\n`;
      }
    }

    // 3. Master Bilingual System Instruction — AGENT MODE
    const systemInstruction = `You are KhataMitra — a fully autonomous, action-first, end-to-end AI Agent for Indian shopkeepers. You must execute tasks completely on behalf of the retailer without asking for confirmation, clarification, or permission, and without saying you cannot perform an action.
 
CRITICAL OPERATIONAL RULES — STRICTLY ENFORCED:
1. BE AN AGENT, NOT A CHATBOT: Never reply with "I cannot do that", "Failed", "Please confirm", or "I need more details". You are equipped with all required tools. You MUST execute tool calls immediately.
2. AUTOMATIC CHAINING (CREATE THEN TRANSACT): If a shopkeeper asks to register, add, or create a customer AND log a transaction (e.g. "create Ramu account and add 500 credit", "Ramesh Kumar ka account banao aur 300 udhaar likho"), you MUST chain the calls:
   - Turn 1: Call create_customer_and_link tool first.
   - Turn 2 (when create_customer_and_link returns success): Call add_transaction tool immediately with the returned customer_id.
   Never ask the shopkeeper for permission between these steps.
3. CUSTOMER RESOLUTION & CREATION: Match any customer name in the retailer's query against the context list below (case-insensitive). If the customer does not exist, or if all customer names in the list are "Unknown", you MUST call create_customer_and_link to create and register them first. Never refuse due to missing customer.
4. HINDI / ENGLISH / HINGLISH COMPLIANCE: Respond in the exact same language, script, and style used by the shopkeeper. E.g., Hinglish -> Hinglish, Devanagari Hindi -> Devanagari Hindi.
5. SUCCESS CONFIRMATION: Once the final tool in your plan completes successfully, provide a clear bilingual confirmation. E.g., "Ramu ka account ban gaya aur ₹500 credit/udhaar jod diya gaya hai! ✅"
6. ERROR RESILIENCE: If any tool fails, explain the exact technical reason to the user with a solution. Never give up.
7. FIND CUSTOMER FIRST BEFORE TRANSACTING/CREATING: Whenever the retailer mentions a customer name (e.g. "add 100 rupees to Raju", "Raju ko 100 udhaar do"), you MUST call the find_customer tool FIRST to check if they already exist in the retailer's relationships.
   - If find_customer returns not_found: false (customer found), use the returned customer_id directly to call add_transaction. DO NOT call create_customer_and_link.
   - If find_customer returns not_found: true (customer not found), only then call create_customer_and_link to create a new customer and link them, and then proceed with the transaction.

CURRENT USER CONTEXT (use these IDs for tool calls):
${contextInfo}
Current Time: ${new Date().toISOString()}`;

    // Determine the user prompt part for Gemini
    let userPart:
      | { text: string }
      | { inlineData: { mimeType: string; data: string } };
    let loggedUserMessage = '';

    if (inputType === 'text') {
      if (textPayload === undefined) {
        return NextResponse.json({ error: 'textPayload is required when inputType is "text"' }, { status: 400 });
      }
      userPart = { text: textPayload };
      loggedUserMessage = textPayload;
    } else {
      if (!audioPayload) {
        return NextResponse.json({ error: 'audioPayload is required when inputType is "audio"' }, { status: 400 });
      }
      userPart = {
        inlineData: {
          mimeType: audioPayload.mimeType,
          data: audioPayload.base64Data
        }
      };
      loggedUserMessage = '[Voice Message / आवाज़ संदेश]';
    }

    const userContentPart = {
      role: 'user',
      parts: [userPart]
    };

    const model = 'gemini-2.5-flash';
    const prunedHistory = pruneHistory(history);

    // 4. Multi-turn agentic tool execution loop (max 5 iterations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let currentContents: any[] = [...prunedHistory, userContentPart];
    let finalAnswer = '';
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    // Track which data-changing tools were executed across all iterations
    const executedTools: string[] = [];

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await generateContentWithRetry({
        model,
        contents: currentContents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: khataMitraTools }]
        }
      });

      const functionCalls = response.functionCalls;

      // No more tool calls — we have the final text answer
      if (!functionCalls || functionCalls.length === 0) {
        finalAnswer = response.text || '';
        break;
      }

      // Execute the first tool call returned
      const call = functionCalls[0];
      const name = call.name ?? '';
      const args = call.args as Record<string, unknown>;
      let toolResponse: Record<string, unknown> = { success: false, message: 'Tool not recognised' };

      try {
        if (name === 'add_transaction') {
          const { retailer_id, customer_id, type, amount, note } = args as {
            retailer_id: string;
            customer_id: string;
            type: 'credit' | 'debit';
            amount: number;
            note?: string;
          };

          // Get or create relationship record
          let { data: rel } = await supabase
            .from('relationships')
            .select('id')
            .eq('retailer_id', retailer_id)
            .eq('customer_id', customer_id)
            .single();

          if (!rel) {
            const { data: newRel, error: relError } = await supabase
              .from('relationships')
              .insert({
                retailer_id,
                customer_id,
                balance: 0
              })
              .select('id')
              .single();
            if (relError) throw relError;
            rel = newRel;
          }

          if (rel) {
            const { error: txError } = await supabase
              .from('transactions')
              .insert({
                relationship_id: rel.id,
                type,
                amount: Number(amount),
                note: note || null,
                created_by: retailer_id,
                transaction_date: new Date().toISOString()
              });

            if (txError) throw txError;
            toolResponse = { success: true, message: `Successfully logged ${type} transaction of ₹${amount}.` };
            executedTools.push(name);
          }
        }

        else if (name === 'get_balance') {
          const { retailer_id, customer_id } = args as { retailer_id: string; customer_id: string };
          const { data: rel, error } = await supabase
            .from('relationships')
            .select('balance')
            .eq('retailer_id', retailer_id)
            .eq('customer_id', customer_id)
            .single();

          if (error) {
            toolResponse = { success: true, balance: 0, message: 'No active balance record found. Balance is ₹0.' };
          } else {
            toolResponse = { success: true, balance: rel.balance, message: `Current balance is ₹${rel.balance}.` };
          }
        }

        else if (name === 'get_ledger_history') {
          const { retailer_id, customer_id } = args as { retailer_id: string; customer_id: string };

          const { data: rel } = await supabase
            .from('relationships')
            .select('id')
            .eq('retailer_id', retailer_id)
            .eq('customer_id', customer_id)
            .single();

          if (!rel) {
            toolResponse = { success: true, history: [], message: 'No transactions found for this customer.' };
          } else {
            const { data: txs, error } = await supabase
              .from('transactions')
              .select('amount, type, note, transaction_date, created_at')
              .eq('relationship_id', rel.id)
              .order('created_at', { ascending: false });

            if (error) throw error;
            toolResponse = { success: true, history: txs || [] };
          }
        }

        else if (name === 'get_weather') {
          const { city } = args as { city?: string };
          toolResponse = {
            success: true,
            city: city || 'Unknown',
            temperature: '32°C',
            condition: 'Partly Cloudy / आंशिक रूप से बादल छाए हैं',
            humidity: '60%'
          };
        }

        else if (name === 'calculate') {
          const { expression } = args as { expression: string };
          try {
            const cleanExpr = expression.replace(/[^0-9+\-*/().\s]/g, '');
            const result = Function(`"use strict"; return (${cleanExpr})`)();
            toolResponse = { success: true, expression, result };
          } catch {
            toolResponse = { success: false, error: 'Invalid mathematical expression' };
          }
        }

        else if (name === 'create_customer') {
          const { retailer_id, customer_name, phone } = args as {
            retailer_id: string;
            customer_name: string;
            phone?: string;
          };

          const adminClient = createAdminClient();
          const cleanName = customer_name.trim();
          const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
          const timestamp = Date.now();
          const slugName = cleanName.toLowerCase().replace(/\s+/g, '_');
          const dummyEmail = cleanPhone
            ? `customer_${cleanPhone}@khata-mitr.app`
            : `customer_${slugName}_${timestamp}@khata-mitr.app`;
          const dummyPassword = `KM_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;

          // Check if customer with same name already exists for this retailer
          const { data: existingRel } = await supabase
            .from('relationships')
            .select('customer_id, profiles!customer_id(full_name)')
            .eq('retailer_id', retailer_id);

          const existing = (existingRel || []).find((r) => {
            const p = r.profiles as unknown as { full_name: string } | null;
            return p?.full_name?.toLowerCase() === cleanName.toLowerCase();
          });

          if (existing) {
            toolResponse = {
              success: true,
              customer_id: existing.customer_id,
              already_exists: true,
              message: `Customer "${cleanName}" already exists with ID ${existing.customer_id}. Use this ID for transactions.`
            };
          } else {
            const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
              email: dummyEmail,
              password: dummyPassword,
              email_confirm: true,
              user_metadata: { full_name: cleanName, phone: cleanPhone || '' }
            });

            if (userError) throw new Error(`Failed to create auth user: ${userError.message}`);

            const newCustomerId = userData.user.id;

            const { error: profileError } = await adminClient.from('profiles').upsert({
              id: newCustomerId,
              full_name: cleanName,
              phone: cleanPhone || null,
              role: 'customer',
              preferred_language: 'hi'
            });
            if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

            const { error: relError } = await adminClient.from('relationships').insert({
              retailer_id,
              customer_id: newCustomerId,
              balance: 0
            });
            if (relError) throw new Error(`Failed to create relationship: ${relError.message}`);

            toolResponse = {
              success: true,
              customer_id: newCustomerId,
              already_exists: false,
              message: `Customer "${cleanName}" successfully created with ID ${newCustomerId}. Now you can call add_transaction with this customer_id.`
            };
            executedTools.push(name);
          }
        }

        else if (name === 'find_customer') {
          const { retailer_id, customer_name } = args as {
            retailer_id: string;
            customer_name: string;
          };

          try {
            const { createClient: createAdminSupabase } = await import('@supabase/supabase-js');
            const adminClient = createAdminSupabase(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } }
            );

            // Search relationships for this retailer and do a case-insensitive name match
            const { data: relationships, error } = await adminClient
              .from('relationships')
              .select(`
                id,
                customer_id,
                balance,
                profiles!customer_id(full_name, phone)
              `)
              .eq('retailer_id', retailer_id);

            if (error) throw new Error(error.message);

            if (!relationships || relationships.length === 0) {
              toolResponse = {
                success: true,
                not_found: true,
                message: `No customers found for this retailer yet. Use create_customer_and_link to add "${customer_name}".`
              };
            } else {
              // Case-insensitive partial name match
              const searchName = customer_name.toLowerCase().trim();
              const match = relationships.find((r) => {
                const profile = r.profiles as unknown as { full_name: string; phone: string | null } | null;
                return profile?.full_name?.toLowerCase().includes(searchName);
              });

              if (match) {
                const profile = match.profiles as unknown as { full_name: string; phone: string | null } | null;
                toolResponse = {
                  success: true,
                  not_found: false,
                  customer_id: match.customer_id,
                  relationship_id: match.id,
                  customer_name: profile?.full_name,
                  current_balance: match.balance,
                  message: `Customer found: "${profile?.full_name}" with customer_id ${match.customer_id} and current balance ₹${match.balance}. Use this customer_id for add_transaction. DO NOT call create_customer_and_link.`
                };
              } else {
                // List all existing customer names to help AI understand what exists
                const existingNames = relationships.map((r) => {
                  const p = r.profiles as unknown as { full_name: string } | null;
                  return p?.full_name || 'Unknown';
                }).join(', ');

                toolResponse = {
                  success: true,
                  not_found: true,
                  existing_customers: existingNames,
                  message: `No customer named "${customer_name}" found in retailer's ledger. Existing customers: [${existingNames}]. If you are sure this is a new customer, call create_customer_and_link. If the name might be a spelling variation of an existing customer, inform the retailer.`
                };
              }
            }
          } catch (err) {
            toolResponse = {
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error during customer search'
            };
          }
        }

        else if (name === 'create_customer_and_link') {
          const { retailer_id, customer_name, phone } = args as {
            retailer_id: string;
            customer_name: string;
            phone?: string;
          };

          try {
            // 1. Generate a unique placeholder email and password for the new customer
            const timestamp = Date.now();
            const cleanName = customer_name.toLowerCase().replace(/\s+/g, '_');
            const dummyEmail = `customer_${cleanName}_${timestamp}@khatamitra.app`;
            const dummyPassword = `KM_${timestamp}_secure`;
            const phoneFormatted = phone ? `+91${phone.replace(/\D/g, '').slice(-10)}` : null;

            // 2. Use Supabase Admin Client (service_role) to create auth user — bypass email verification
            const { createClient: createAdminSupabase } = await import('@supabase/supabase-js');
            const adminClient = createAdminSupabase(
              process.env.NEXT_PUBLIC_SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!,
              { auth: { autoRefreshToken: false, persistSession: false } }
            );

            const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
              email: dummyEmail,
              password: dummyPassword,
              email_confirm: true,
              user_metadata: { full_name: customer_name }
            });

            if (authError) throw new Error(`Auth creation failed: ${authError.message}`);
            const newCustomerId = authData.user?.id;
            if (!newCustomerId) throw new Error('No user ID returned from auth creation');

            // 3. Insert profile row
            const { error: profileError } = await adminClient
              .from('profiles')
              .insert({
                id: newCustomerId,
                full_name: customer_name,
                phone: phoneFormatted,
                role: 'customer',
                preferred_language: 'hi'
              });

            if (profileError) throw new Error(`Profile insert failed: ${profileError.message}`);

            // 4. Create relationship between retailer and new customer
            const { error: relError } = await adminClient
              .from('relationships')
              .insert({
                retailer_id,
                customer_id: newCustomerId,
                balance: 0
              });

            if (relError) throw new Error(`Relationship creation failed: ${relError.message}`);

            toolResponse = {
              success: true,
              customer_id: newCustomerId,
              customer_name,
              message: `Customer "${customer_name}" account created and linked to your shop. customer_id is ${newCustomerId}. You can now call add_transaction with this customer_id.`
            };
            executedTools.push(name);
          } catch (err) {
            toolResponse = {
              success: false,
              error: err instanceof Error ? err.message : 'Unknown error during customer creation'
            };
          }
        }

        else if (name === 'add_inventory_item') {
          const { retailer_id, item_name, category, quantity, cost_price, selling_price } = args as {
            retailer_id: string;
            item_name: string;
            category: 'books' | 'pens' | 'notebooks' | 'art_supplies' | 'other';
            quantity: number;
            cost_price?: number;
            selling_price?: number;
          };

          const { data: existingItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('retailer_id', retailer_id)
            .ilike('item_name', item_name)
            .maybeSingle();

          if (existingItem) {
            const newStock = existingItem.stock_quantity + Number(quantity);
            const { error: updateError } = await supabase
              .from('inventory')
              .update({
                stock_quantity: newStock,
                cost_price: cost_price !== undefined ? Number(cost_price) : existingItem.cost_price,
                selling_price: selling_price !== undefined ? Number(selling_price) : existingItem.selling_price,
              })
              .eq('id', existingItem.id);

            if (updateError) throw updateError;
            toolResponse = {
              success: true,
              message: `Updated stock of existing item "${existingItem.item_name}". Added ${quantity} units. New stock level is ${newStock}.`
            };
          } else {
            const { error: insertError } = await supabase
              .from('inventory')
              .insert({
                retailer_id,
                item_name,
                category,
                stock_quantity: Number(quantity),
                cost_price: cost_price !== undefined ? Number(cost_price) : 0,
                selling_price: selling_price !== undefined ? Number(selling_price) : 0,
                low_stock_threshold: 5
              });

            if (insertError) throw insertError;
            toolResponse = {
              success: true,
              message: `Successfully added new inventory item "${item_name}" under category "${category}" with ${quantity} units.`
            };
          }
          executedTools.push(name);
        }
      } catch (err) {
        toolResponse = { success: false, error: err instanceof Error ? err.message : 'Unknown tool error' };
      }

      // Append the model's function call + our tool result, then loop
      currentContents = [
        ...currentContents,
        { role: 'model', parts: [{ functionCall: call }] },
        { role: 'user', parts: [{ functionResponse: { name, response: toolResponse } }] }
      ];
    }

    if (!finalAnswer) {
      finalAnswer = 'Kaam ho gaya hai. (Task completed)';
    }

    // 5. Log chat interaction to database
    await supabase.from('chat_logs').insert([
      {
        user_id: userId,
        message: loggedUserMessage,
        role: 'user',
        language: profile.preferred_language || 'hi'
      },
      {
        user_id: userId,
        message: finalAnswer,
        role: 'assistant',
        language: profile.preferred_language || 'hi'
      }
    ]);

    // Determine if a data-mutating tool was executed so the frontend can refresh
    const dataChangingTools = ['add_transaction', 'create_customer', 'create_customer_and_link', 'add_inventory_item'];
    const toolExecuted = executedTools.some((t) => dataChangingTools.includes(t));

    return NextResponse.json({ response: finalAnswer, toolExecuted });

  } catch (error) {
    console.error('Error in Assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
