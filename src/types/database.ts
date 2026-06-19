export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          role: 'retailer' | 'customer';
          business_name: string | null;
          preferred_language: 'hi' | 'en';
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          role: 'retailer' | 'customer';
          business_name?: string | null;
          preferred_language?: 'hi' | 'en';
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          role?: 'retailer' | 'customer';
          business_name?: string | null;
          preferred_language?: 'hi' | 'en';
          created_at?: string;
        };
      };
      relationships: {
        Row: {
          id: string;
          retailer_id: string;
          customer_id: string;
          balance: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          retailer_id: string;
          customer_id: string;
          balance?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          retailer_id?: string;
          customer_id?: string;
          balance?: number;
          created_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          relationship_id: string;
          type: 'credit' | 'debit';
          amount: number;
          note: string | null;
          created_by: string | null;
          transaction_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          relationship_id: string;
          type: 'credit' | 'debit';
          amount: number;
          note?: string | null;
          created_by?: string | null;
          transaction_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          relationship_id?: string;
          type?: 'credit' | 'debit';
          amount?: number;
          note?: string | null;
          created_by?: string | null;
          transaction_date?: string;
          created_at?: string;
        };
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          relationship_id: string | null;
          remind_at: string;
          type: 'call' | 'payment';
          message: string;
          status: 'pending' | 'sent' | 'done';
          channel: 'app' | 'whatsapp' | 'sms' | 'email';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          relationship_id?: string | null;
          remind_at: string;
          type: 'call' | 'payment';
          message: string;
          status?: 'pending' | 'sent' | 'done';
          channel?: 'app' | 'whatsapp' | 'sms' | 'email';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          relationship_id?: string | null;
          remind_at?: string;
          type?: 'call' | 'payment';
          message?: string;
          status?: 'pending' | 'sent' | 'done';
          channel?: 'app' | 'whatsapp' | 'sms' | 'email';
          created_at?: string;
        };
      };
      chat_logs: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'assistant';
          message: string;
          language: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'user' | 'assistant';
          message: string;
          language?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'user' | 'assistant';
          message?: string;
          language?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
