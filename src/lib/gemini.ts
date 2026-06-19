import { GoogleGenAI, Type } from '@google/genai';

// Initialize the Google Gen AI client using GEMINI_API_KEY
// Note: Fallback to empty string if not defined; should be present in process.env
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

// Tool Definitions
export const transactionTool = {
  name: 'record_transaction',
  description: 'Records a credit (Udhaar/Lent) or debit (Jama/Received) ledger entry for a customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: {
        type: Type.STRING,
        description: 'Name of the customer (e.g., Ramu, Raju, Mohan).'
      },
      amount: {
        type: Type.NUMBER,
        description: 'Amount of money in Rupees.'
      },
      type: {
        type: Type.STRING,
        enum: ['credit', 'debit'],
        description: 'Use "credit" if money is lent/owed (Udhaar) and "debit" if money is received/settled (Jama).'
      },
      description: {
        type: Type.STRING,
        description: 'Optional description of the items bought/returned or reason (e.g., "doodh", "sugar").'
      }
    },
    required: ['customerName', 'amount', 'type']
  }
};

export const reminderTool = {
  name: 'create_reminder',
  description: 'Schedules a payment collection reminder for a customer.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      customerName: {
        type: Type.STRING,
        description: 'Name of the customer.'
      },
      message: {
        type: Type.STRING,
        description: 'Reminder message to send (e.g., "Please clear your outstanding bill of Rs 500").'
      },
      dueDate: {
        type: Type.STRING,
        description: 'The due date and time for the reminder in ISO 8601 format (e.g. 2026-06-25T10:00:00Z).'
      }
    },
    required: ['customerName', 'message', 'dueDate']
  }
};

export const weatherTool = {
  name: 'get_weather',
  description: 'Fetches the current weather information for a given city or locality.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The city or region to query weather for (e.g., Delhi, Mumbai, Lucknow).'
      }
    },
    required: ['location']
  }
};

export const cricketTool = {
  name: 'get_cricket_score',
  description: 'Fetches live cricket match scores and updates.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      matchId: {
        type: Type.STRING,
        description: 'Optional match ID. If not provided, returns list of current live matches.'
      }
    }
  }
};

export const mathTool = {
  name: 'solve_math',
  description: 'Performs arithmetic calculation for billing, accounting, and ledger interest calculations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: 'The mathematical expression to evaluate (e.g. "120 * 5 + 450").'
      }
    },
    required: ['expression']
  }
};

// All available tools grouped
export const khataMitraTools = [
  transactionTool,
  reminderTool,
  weatherTool,
  cricketTool,
  mathTool
];
