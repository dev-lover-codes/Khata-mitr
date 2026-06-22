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

    // 3. Dynamic Contents construction and Master Bilingual System Instruction
    const systemInstruction = `You are KhataMitra — a powerful, action-first AI Agent for Indian shopkeepers. You understand English, Hindi (Devanagari), and Roman Hinglish.

CRITICAL RULES — FOLLOW WITHOUT EXCEPTION:
1. ALWAYS ACT — Never apologise, never say "I cannot do that". ALWAYS call the appropriate tool immediately.
2. CREATE BEFORE TRANSACT — If the shopkeeper wants to add a new customer AND record a transaction (e.g. "Ramu ka account banao aur 500 credit karo"), FIRST call create_customer, THEN call add_transaction with the returned customer_id.
3. FIND BY NAME — Match customer names from the context list (case-insensitive, partial match OK). If the customer does not exist yet, ALWAYS use create_customer to create them first.
4. REPLY IN SAME LANGUAGE — Reply in the exact same language/script the shopkeeper used. Hinglish → Hinglish. Hindi → Hindi. English → English.
5. CONFIRM ACTIONS — After every tool success, confirm what was done with the amount and name. E.g. "Ramu ka account ban gaya aur ₹500 credit ho gaye!"

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
    const response = await generateContentWithRetry({
      model,
      contents: [...prunedHistory, userContentPart],
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: khataMitraTools }]
      }
    });

    const functionCalls = response.functionCalls;
    let finalAnswer = response.text || '';

    // 4. Handle Tool Calls
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const name = call.name;
      const args = call.args as Record<string, unknown>;
      let toolResponse: Record<string, unknown> = { success: false, message: 'Tool execution failed' };

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
            // Create new Supabase auth user
            const { data: userData, error: userError } = await adminClient.auth.admin.createUser({
              email: dummyEmail,
              password: dummyPassword,
              email_confirm: true,
              user_metadata: { full_name: cleanName, phone: cleanPhone || '' }
            });

            if (userError) throw new Error(`Failed to create auth user: ${userError.message}`);

            const newCustomerId = userData.user.id;

            // Insert profile row
            const { error: profileError } = await adminClient.from('profiles').upsert({
              id: newCustomerId,
              full_name: cleanName,
              phone: cleanPhone || null,
              role: 'customer',
              preferred_language: 'hi'
            });
            if (profileError) throw new Error(`Failed to create profile: ${profileError.message}`);

            // Create relationship between retailer and new customer
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

          // Check if item already exists in inventory (under this retailer_id and matching item_name exactly, case-insensitive)
          const { data: existingItem } = await supabase
            .from('inventory')
            .select('*')
            .eq('retailer_id', retailer_id)
            .ilike('item_name', item_name)
            .maybeSingle();

          if (existingItem) {
            // Update quantity of existing item
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
            // Insert new item
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
        }
      } catch (err) {
        toolResponse = { success: false, error: err instanceof Error ? err.message : 'Unknown tool error' };
      }

      // Send execution response back to Gemini to compile final conversational response
      const finalResult = await generateContentWithRetry({
        model,
        contents: [
          ...prunedHistory,
          userContentPart,
          { role: 'model', parts: [{ functionCall: call }] },
          { role: 'user', parts: [{ functionResponse: { name, response: toolResponse } }] }
        ],
        config: {
          systemInstruction
        }
      });

      finalAnswer = finalResult.text || '';
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
    const dataChangingTools = ['add_transaction', 'create_customer', 'add_inventory_item'];
    const toolExecuted = functionCalls && functionCalls.length > 0
      ? dataChangingTools.includes(functionCalls[0].name || '')
      : false;

    return NextResponse.json({ response: finalAnswer, toolExecuted });

  } catch (error) {
    console.error('Error in Assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
