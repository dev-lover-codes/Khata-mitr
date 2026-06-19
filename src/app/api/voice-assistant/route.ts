import { NextRequest, NextResponse } from 'next/server';
import { ai, khataMitraTools } from '@/lib/gemini';
import { createClient } from '@/lib/supabase/server';

interface ToolArguments {
  customerName?: string;
  amount?: number;
  type?: 'credit' | 'debit';
  description?: string;
  message?: string;
  dueDate?: string;
  location?: string;
  expression?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { audio, mimeType } = body; // audio is a base64 encoded string

    if (!audio) {
      return NextResponse.json({ error: 'Audio data is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Resolve user profile (default to a mock/demo retailer if not authenticated)
    let retailerProfileId = '';
    let retailerName = 'Demo Retailer';

    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', authUser.id)
        .single();

      if (profile) {
        retailerProfileId = profile.id;
        retailerName = profile.full_name;
      }
    }

    // Fallback demo user
    if (!retailerProfileId) {
      const { data: demo } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('phone', '+919876543210')
        .single();

      if (demo) {
        retailerProfileId = demo.id;
        retailerName = demo.full_name;
      }
    }

    // 2. Multimodal Gemini Setup
    const systemInstruction = `You are KhataMitra, a bilingual AI ledger assistant for local shops.
Current Retailer: ${retailerName} (ID: ${retailerProfileId})
Current Time: ${new Date().toISOString()}

The user is sending an audio/voice message. Listen to the audio, determine the command (e.g. logging Udhaar/Jama, creating reminders), and execute the appropriate tool call.
Always answer in a conversational bilingual format (Hindi + English). First transcribe what you heard, then provide the response.`;

    const model = 'gemini-2.0-flash';

    // Prepare audio content (Content object with user role)
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

    // Call model with audio input
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

    // 3. Handle Tool Calls
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      const args = call.args as unknown as ToolArguments;
      let toolResponse: Record<string, unknown> = { success: false, message: 'Tool execution failed' };

      try {
        if (call.name === 'record_transaction') {
          const { customerName, amount, type, description } = args;

          if (customerName && amount && type) {
            let customerId = '';
            const { data: customers } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'customer')
              .ilike('full_name', `%${customerName}%`);

            if (customers && customers.length > 0) {
              customerId = customers[0].id;
            } else {
              // Create customer
              const { data: newCust } = await supabase
                .from('profiles')
                .insert({
                  role: 'customer',
                  full_name: customerName,
                  phone: `+919999${Math.floor(100000 + Math.random() * 900000)}`
                })
                .select('id')
                .single();

              if (newCust) {
                customerId = newCust.id;
                await supabase
                  .from('relationships')
                  .insert({
                    retailer_id: retailerProfileId,
                    customer_id: customerId
                  });
              }
            }

            if (customerId) {
              const { error: txError } = await supabase
                .from('transactions')
                .insert({
                  retailer_id: retailerProfileId,
                  customer_id: customerId,
                  amount,
                  type,
                  description: description || `AI Voice logged ${type}`
                });

              if (!txError) {
                toolResponse = {
                  success: true,
                  message: `Successfully logged voice transaction: ${type} of ₹${amount} for ${customerName}.`
                };
              }
            }
          }
        } 
        
        else if (call.name === 'create_reminder') {
          const { customerName, message: reminderMsg, dueDate } = args;

          if (customerName && reminderMsg && dueDate) {
            let customerId = '';
            const { data: customers } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'customer')
              .ilike('full_name', `%${customerName}%`);

            if (customers && customers.length > 0) {
              customerId = customers[0].id;
            } else {
              const { data: newCust } = await supabase
                .from('profiles')
                .insert({
                  role: 'customer',
                  full_name: customerName,
                  phone: `+919999${Math.floor(100000 + Math.random() * 900000)}`
                })
                .select('id')
                .single();

              if (newCust) {
                customerId = newCust.id;
                await supabase
                  .from('relationships')
                  .insert({
                    retailer_id: retailerProfileId,
                    customer_id: customerId
                  });
              }
            }

            if (customerId) {
              const { error: remError } = await supabase
                .from('reminders')
                .insert({
                  retailer_id: retailerProfileId,
                  customer_id: customerId,
                  message: reminderMsg,
                  due_date: dueDate,
                  status: 'pending'
                });

              if (!remError) {
                toolResponse = {
                  success: true,
                  message: `Scheduled reminder for ${customerName} on ${new Date(dueDate).toLocaleString()}.`
                };
              }
            }
          }
        } 
        
        else if (call.name === 'get_weather') {
          const { location } = args;
          toolResponse = { success: true, location: location || 'Unknown', temperature: '29°C', condition: 'Rainy / बारिश' };
        } 
        
        else if (call.name === 'get_cricket_score') {
          toolResponse = { success: true, score: 'India: 182/4, live match updates' };
        } 
        
        else if (call.name === 'solve_math') {
          const { expression } = args;
          if (expression) {
            try {
              const cleanExpr = expression.replace(/[^0-9+\-*/().\s]/g, '');
              const result = Function(`"use strict"; return (${cleanExpr})`)();
              toolResponse = { success: true, expression, result };
            } catch {
              toolResponse = { success: false };
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown tool error';
        toolResponse = { success: false, error: errorMessage };
      }

      // Re-invoke model with function response
      const finalResult = await ai.models.generateContent({
        model,
        contents: [
          audioContent,
          { role: 'model', parts: [{ functionCall: call }] },
          { role: 'user', parts: [{ functionResponse: { name: call.name, response: toolResponse } }] }
        ],
        config: {
          systemInstruction
        }
      });

      finalAnswer = finalResult.text || '';
    }

    // 4. Log interaction
    await supabase
      .from('chat_logs')
      .insert({
        user_id: retailerProfileId,
        message: '[Voice Input]',
        response: finalAnswer,
        mode: 'voice'
      });

    return NextResponse.json({ response: finalAnswer });

  } catch (error) {
    console.error('Error in Voice Assistant:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
