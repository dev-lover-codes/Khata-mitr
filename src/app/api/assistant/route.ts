import { NextRequest, NextResponse } from 'next/server';
import { khataMitraTools, generateContentWithRetry } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
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
    const systemInstruction = `You are DukaanBook’s native Indian shopkeeper AI Agent. You will receive input as either written text or a raw voice audio recording. The shopkeeper will speak or type in pure English, pure Hindi (Devanagari script), or Roman Hinglish.
Your operational mandate is strictly 3 steps:
Step 1: Listen to the audio or read the text, and deduce the core ledger intent, regardless of grammar or slang.
Step 2: Autonomously call the required database tools (e.g., create_profile, add_transaction).
Step 3: Once the database returns success, analyze the EXACT language and script the shopkeeper used to communicate with you, and reply back to them in that exact same tongue. If they spoke Roman Hinglish ("Ramesh ka 500 likho"), reply in clean Roman Hinglish ("Ramesh ke account me ₹500 likh diye hain"). If they used Devanagari Hindi, reply in Devanagari Hindi.

Here is the current user profile context for your database operations:
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

    const model = 'gemini-2.0-flash';
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

    return NextResponse.json({ response: finalAnswer });

  } catch (error) {
    console.error('Error in Assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
