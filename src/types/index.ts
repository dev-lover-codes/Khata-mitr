// src/types/index.ts

export type UserRole = 'retailer' | 'customer';

export type Language = 'en' | 'hi';

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  shopName?: string; // Optional for retailers
  createdAt: string;
}

export interface Customer {
  id: string;
  retailerId: string;
  name: string;
  phone: string;
  currentBalance: number; // Positive means customer owes retailer (Credit/उधार), Negative means customer has advanced balance
  createdAt: string;
}

export interface Transaction {
  id: string;
  ledgerId: string; // References Customer or Ledger ID
  amount: number;
  type: 'credit' | 'debit'; // 'credit' (उधार/Lent) vs 'debit' (जमा/Received)
  description?: string;
  date: string;
  createdAt: string;
}
