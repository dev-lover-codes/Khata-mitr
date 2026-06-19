import { GoogleGenAI, Type } from '@google/genai';

// Initialize the Google Gen AI client using GEMINI_API_KEY
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

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

// All available tools grouped
export const khataMitraTools = [
  addTransactionTool,
  getBalanceTool,
  getLedgerHistoryTool,
  weatherTool,
  calculateTool
];
