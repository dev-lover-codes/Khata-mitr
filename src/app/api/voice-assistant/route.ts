import { NextRequest, NextResponse } from 'next/server';
import { ai, khataMitraTools } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const voiceRequestSchema = z.object({
  audio: z.string().min(1, 'Audio data is required'),
  mimeType: z.string().optional(),
  userId: z.string().uuid('Invalid user ID')
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = voiceRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.errors[0].message }, { status: 400 });
    }

    const { audio, mimeType, userId } = parseResult.data;

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

    // 3. System Prompt and Instructions
    const systemInstruction = `You are KhataMitra, a friendly, concise, and helpful financial assistant for Indian shopkeepers (retailers) and customers.
You support interactions in Hindi (हिंदी), English, and Hinglish (Hindi written in Latin script, e.g., "Ramu ko 200 rupaye udhaar").
Your current user profile context is:
${contextInfo}
Current Time: ${new Date().toISOString()}

The user is sending a voice message. Listen to the audio, determine the command (e.g. logging Udhaar/Jama, checking balances, weather, math), and execute the appropriate tool call.
Always answer in a conversational bilingual format (Hindi + English). First transcribe what you heard from the user, and then provide the assistant response.

Operational Guidelines:
1. NEVER invent or hallucinate balances, customer names, or transaction histories. Always call the relevant database tools first to query or record data.
2. Trust tool results completely. If a tool reports a balance of ₹500, state it exactly. If a transaction succeeds, confirm it.
3. Be polite and concise. Indian shopkeepers value quick, clear answers without excessive fluff.
4. Answer in the language preferred by the user, or use Hinglish if they talk in Hinglish.
5. If the user asks about a customer or retailer not in their list, inform them politely that the connection or customer does not exist in their active database yet.
6. When recording or querying ledger items, invoke the matching function declaration.`;

    const model = 'gemini-2.0-flash';
    const audioContent = {
      role: 'user',
      parts: [
        {
          inlineData: {
            data: audio,
            mimeType: mimeType || 'audio/wav'
          }
        }
      ]
    };

    const response = await ai.models.generateContent({
      model,
      contents: [audioContent],
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
      } catch (err) {
        toolResponse = { success: false, error: err instanceof Error ? err.message : 'Unknown tool error' };
      }

      // Send execution response back to Gemini to compile final conversational response
      const finalResult = await ai.models.generateContent({
        model,
        contents: [
          audioContent,
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
        message: '[Voice Input]',
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
    console.error('Error in Voice Assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
