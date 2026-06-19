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
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Resolve user profile (default to a mock/demo retailer if not authenticated)
    let retailerProfileId = '';
    let retailerName = 'Demo Retailer';

    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser) {
      // Find retailer profile
      let { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('user_id', authUser.id)
        .single();

      if (!profile) {
        // Auto-seed profile for testing
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            user_id: authUser.id,
            role: 'retailer',
            full_name: authUser.user_metadata?.full_name || 'Retailer User',
            phone: authUser.phone || `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
            shop_name: 'KhataMitra General Store'
          })
          .select('id, full_name, role')
          .single();

        if (newProfile) {
          profile = newProfile;
        }
      }

      if (profile) {
        retailerProfileId = profile.id;
        retailerName = profile.full_name;
      }
    }

    // Fallback: Seed / Fetch a demo retailer from database so API never crashes in dev
    if (!retailerProfileId) {
      const { data: existingDemo } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('phone', '+919876543210')
        .single();

      if (existingDemo) {
        retailerProfileId = existingDemo.id;
        retailerName = existingDemo.full_name;
      } else {
        // Insert a demo retailer
        const { data: newDemo } = await supabase
          .from('profiles')
          .insert({
            role: 'retailer',
            full_name: 'Raju Bhai (Kirana)',
            phone: '+919876543210',
            shop_name: 'Mitra General Store'
          })
          .select('id, full_name')
          .single();

        if (newDemo) {
          retailerProfileId = newDemo.id;
          retailerName = newDemo.full_name;
        }
      }
    }

    // 2. Call Gemini
    const systemInstruction = `You are KhataMitra, a bilingual AI ledger assistant for retailers and customers.
Current Retailer: ${retailerName} (ID: ${retailerProfileId})
Current Time: ${new Date().toISOString()}

Handle user credit (Udhaar/उधार) and debit (Jama/जमा) records, reminders, weather, cricket scores, and math.
Always write bilingual answers (mix of Hindi/English or clean translations). 
If the user wants to record a transaction or reminder, invoke the relevant tool call.`;

    const model = 'gemini-2.0-flash';
    const response = await ai.models.generateContent({
      model,
      contents: message,
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
            // Lookup customer profile by full_name or relationship
            let customerId = '';
            const { data: customers } = await supabase
              .from('profiles')
              .select('id, full_name')
              .eq('role', 'customer')
              .ilike('full_name', `%${customerName}%`);

            if (customers && customers.length > 0) {
              customerId = customers[0].id;
            } else {
              // Register a mock customer profile if not exists
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

                // Insert relationship link
                await supabase
                  .from('relationships')
                  .insert({
                    retailer_id: retailerProfileId,
                    customer_id: customerId
                  });
              }
            }

            if (customerId) {
              // Log transaction
              const { error: txError } = await supabase
                .from('transactions')
                .insert({
                  retailer_id: retailerProfileId,
                  customer_id: customerId,
                  amount,
                  type,
                  description: description || `AI logged ${type}`
                });

              if (!txError) {
                toolResponse = {
                  success: true,
                  message: `Successfully logged ${type} of ₹${amount} for customer ${customerName}.`
                };
              } else {
                toolResponse = { success: false, message: `DB Error: ${txError.message}` };
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
              // Create customer on the fly
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
              } else {
                toolResponse = { success: false, message: `DB Error: ${remError.message}` };
              }
            }
          }
        } 
        
        else if (call.name === 'get_weather') {
          const { location } = args;
          // Return mock weather
          toolResponse = {
            success: true,
            location: location || 'Unknown',
            temperature: '31°C',
            condition: 'Partly Cloudy / आंशिक रूप से बादल छाए हैं',
            humidity: '65%'
          };
        } 
        
        else if (call.name === 'get_cricket_score') {
          // Return mock cricket score
          toolResponse = {
            success: true,
            match: 'India vs Australia (T20 World Cup)',
            score: 'India: 182/4 (17.4 overs)',
            batsmen: 'Hardik Pandya 42*(18), Rishabh Pant 68(40)',
            status: 'In progress / मैच चालू है'
          };
        } 
        
        else if (call.name === 'solve_math') {
          const { expression } = args;
          if (expression) {
            try {
              // Safely evaluate basic math equations
              const cleanExpr = expression.replace(/[^0-9+\-*/().\s]/g, '');
              const result = Function(`"use strict"; return (${cleanExpr})`)();
              toolResponse = { success: true, expression, result };
            } catch {
              toolResponse = { success: false, message: 'Invalid math expression' };
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown tool error';
        toolResponse = { success: false, error: errorMessage };
      }

      // Send execution response back to Gemini to compile the final conversational reply
      const finalResult = await ai.models.generateContent({
        model,
        contents: [
          { role: 'user', parts: [{ text: message }] },
          { role: 'model', parts: [{ functionCall: call }] },
          { role: 'user', parts: [{ functionResponse: { name: call.name, response: toolResponse } }] }
        ],
        config: {
          systemInstruction
        }
      });

      finalAnswer = finalResult.text || '';
    }

    // 4. Log chat interaction to database
    await supabase
      .from('chat_logs')
      .insert({
        user_id: retailerProfileId,
        message,
        response: finalAnswer,
        mode: 'text'
      });

    return NextResponse.json({ response: finalAnswer });

  } catch (error) {
    console.error('Error in Assistant API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
