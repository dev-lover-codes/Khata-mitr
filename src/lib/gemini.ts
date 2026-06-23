import { GoogleGenAI, Type } from '@google/genai';

// Lazy factory: creates a fresh GoogleGenAI client per call so that
// the latest GEMINI_API_KEY value from process.env is always used.
export function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    console.error('[Gemini] GEMINI_API_KEY is not set in environment variables!');
  } else {
    console.log(`[Gemini] Using API key prefix: ${apiKey.substring(0, 10)}...`);
  }
  return new GoogleGenAI({ apiKey });
}

// Keep a named export for backward compat — lazily resolved on first use
export const ai = getAI();

// Tool Definitions
export const addTransactionTool = {
  name: 'add_transaction',
  description: 'Adds a new credit (money lent/owed) or debit (money received/settled) transaction between a retailer and a customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'The UUID of the retailer.'
      },
      customer_id: {
        type: Type.STRING,
        description: 'The UUID of the customer.'
      },
      type: {
        type: Type.STRING,
        enum: ['credit', 'debit'],
        description: 'Use "credit" if the retailer lent money (Udhaar) and "debit" if the retailer received money (Jama).'
      },
      amount: {
        type: Type.NUMBER,
        description: 'Amount of money in Rupees (INR).'
      },
      note: {
        type: Type.STRING,
        description: 'Optional note or description for the transaction (e.g. sugar, milk, repayment).'
      }
    },
    required: ['retailer_id', 'customer_id', 'type', 'amount']
  }
};

export const getBalanceTool = {
  name: 'get_balance',
  description: 'Retrieves the running balance between a retailer and a customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'The UUID of the retailer.'
      },
      customer_id: {
        type: Type.STRING,
        description: 'The UUID of the customer.'
      }
    },
    required: ['retailer_id', 'customer_id']
  }
};

export const getLedgerHistoryTool = {
  name: 'get_ledger_history',
  description: 'Retrieves the chronological list of transactions (credit and debit log) between a retailer and a customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'The UUID of the retailer.'
      },
      customer_id: {
        type: Type.STRING,
        description: 'The UUID of the customer.'
      }
    },
    required: ['retailer_id', 'customer_id']
  }
};

export const weatherTool = {
  name: 'get_weather',
  description: 'Retrieves current weather status for a given city.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      city: {
        type: Type.STRING,
        description: 'Name of the city (e.g. Delhi, Mumbai).'
      }
    },
    required: ['city']
  }
};

export const calculateTool = {
  name: 'calculate',
  description: 'Evaluates basic mathematical expressions.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: 'The mathematical expression to evaluate (e.g. "150 + 200 * 3").'
      }
    },
    required: ['expression']
  }
};

export const createCustomerTool = {
  name: 'create_customer',
  description: 'Creates a new customer account and links them to the current retailer. Use this when the shopkeeper wants to add a new customer (e.g. "Ramu ka account banao", "Add new customer Raju"). After creating, you can immediately call add_transaction to record any initial credit/debit.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'The UUID of the retailer creating the customer.'
      },
      customer_name: {
        type: Type.STRING,
        description: 'Full name of the new customer (e.g. Ramu, Sita Devi, Mohan Lal).'
      },
      phone: {
        type: Type.STRING,
        description: 'Optional phone number of the customer. If not provided, leave empty string.'
      }
    },
    required: ['retailer_id', 'customer_name']
  }
};

export const createCustomerAndLinkTool = {
  name: 'create_customer_and_link',
  description: 'Creates a new customer profile and links them to the retailer in the relationships table. Use this whenever the retailer asks to create, add, or register a new customer by name (and optionally phone). After creation, you can immediately call add_transaction on the new customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'UUID of the retailer creating this customer.'
      },
      customer_name: {
        type: Type.STRING,
        description: 'Full name of the new customer (e.g. "Ramu", "Ramesh Kumar").'
      },
      phone: {
        type: Type.STRING,
        description: 'Optional 10-digit Indian mobile number without +91 prefix. If not provided, generate a placeholder.'
      }
    },
    required: ['retailer_id', 'customer_name']
  }
};

export const addInventoryItemTool = {
  name: 'add_inventory_item',
  description: 'Adds a new item to the store stationery/book inventory.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'The UUID of the retailer.'
      },
      item_name: {
        type: Type.STRING,
        description: 'The name of the stationery item or book (e.g. "Class 10 Math book", "Pen").'
      },
      category: {
        type: Type.STRING,
        enum: ['books', 'pens', 'notebooks', 'art_supplies', 'other'],
        description: 'The category of the item.'
      },
      quantity: {
        type: Type.INTEGER,
        description: 'The number of copies/items to add to stock.'
      },
      cost_price: {
        type: Type.NUMBER,
        description: 'Optional cost price of the item.'
      },
      selling_price: {
        type: Type.NUMBER,
        description: 'Optional selling price of the item.'
      }
    },
    required: ['retailer_id', 'item_name', 'category', 'quantity']
  }
};

// All available tools grouped
export const findCustomerTool = {
  name: 'find_customer',
  description: 'Search for an existing customer by name within the retailer ledger relationships. ALWAYS call this tool FIRST before calling create_customer_and_link or add_transaction when the user mentions a customer name. Returns customer_id if found, or null if not found. If found, use the returned customer_id directly for add_transaction. Only call create_customer_and_link if this tool returns not_found: true.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      retailer_id: {
        type: Type.STRING,
        description: 'UUID of the retailer.'
      },
      customer_name: {
        type: Type.STRING,
        description: 'The name (or partial name) of the customer to search for (e.g. "Raju", "Ramesh").'
      }
    },
    required: ['retailer_id', 'customer_name']
  }
};

export const khataMitraTools = [
  findCustomerTool,
  addTransactionTool,
  getBalanceTool,
  getLedgerHistoryTool,
  weatherTool,
  calculateTool,
  createCustomerTool,
  createCustomerAndLinkTool,
  addInventoryItemTool
];

/**
 * Executes a Gemini model query with automatic retry backoff on 429 Rate Limits / Resource Exhausted errors
 */
interface GeminiApiError {
  message?: string;
  status?: number;
  details?: {
    retryDelay?: string;
  };
  errorDetails?: {
    retryDelay?: string;
  };
}

export async function generateContentWithRetry(params: Parameters<typeof ai.models.generateContent>[0]) {
  const client = getAI();
  try {
    return await client.models.generateContent(params);
  } catch (rawError) {
    const error = rawError as GeminiApiError;
    const errorStr = String(error?.message || '');
    const errorStringified = JSON.stringify(error);
    const isRateLimit = 
      errorStr.includes('429') || 
      errorStr.includes('RESOURCE_EXHAUSTED') || 
      errorStringified.includes('429') ||
      errorStringified.includes('RESOURCE_EXHAUSTED') ||
      error?.status === 429;

    if (isRateLimit) {
      let delayMs = 4500;
      // Inspect structured retry delay or regex parse "retryDelay" pattern
      const delayStr = error?.details?.retryDelay || error?.errorDetails?.retryDelay || '';
      if (delayStr && typeof delayStr === 'string') {
        const matches = delayStr.match(/(\d+)s/);
        if (matches) {
          delayMs = parseInt(matches[1]) * 1000;
        }
      } else {
        const match = errorStringified.match(/"retryDelay"\s*:\s*"(\d+)s"/i) || errorStr.match(/retryDelay.*?(\d+)s/i);
        if (match) {
          delayMs = parseInt(match[1]) * 1000;
        }
      }

      console.warn(`[Gemini Rate Limit Triggered] 429 Resource Exhausted. Retrying call in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return await getAI().models.generateContent(params);
    }

    throw error;
  }
}

