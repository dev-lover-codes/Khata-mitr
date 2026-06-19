'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatIndianCurrency } from '@/lib/format';
import { ArrowUpRight, ArrowDownLeft, Calendar, FileText, IndianRupee } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  relationship_id: string;
  type: 'credit' | 'debit';
  amount: number;
  note: string | null;
  transaction_date: string;
  created_at: string;
}

interface LedgerHistoryProps {
  relationshipId: string;
  preferredLanguage?: 'hi' | 'en';
}

export default function LedgerHistory({ relationshipId, preferredLanguage = 'hi' }: LedgerHistoryProps) {
  const supabase = createClient();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('relationship_id', relationshipId)
          .order('transaction_date', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) throw error;
        setTransactions(data || []);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setErrorMessage(errorMsg || 'Error fetching transactions.');
      } finally {
        setIsLoading(false);
      }
    }

    if (relationshipId) {
      fetchTransactions();
    }
  }, [relationshipId, supabase]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-2">
        <span className="flex h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-xs text-zinc-400">
          {preferredLanguage === 'hi' ? 'लेन-देन इतिहास लोड हो रहा है...' : 'Loading transaction history...'}
        </p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-600 dark:text-red-400">
        {errorMessage}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center p-8 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
        <p className="text-sm text-zinc-400">
          {preferredLanguage === 'hi' ? 'कोई लेन-देन रिकॉर्ड नहीं मिला।' : 'No transaction records found.'}
        </p>
      </div>
    );
  }

  // Calculate running balances
  const runningTransactions: (Transaction & { runningBalance: number })[] = [];
  let balance = 0;
  for (const tx of transactions) {
    if (tx.type === 'credit') {
      balance += Number(tx.amount);
    } else {
      balance -= Number(tx.amount);
    }
    runningTransactions.push({
      ...tx,
      runningBalance: balance,
    });
  }

  // Reverse to show most recent first in UI while keeping running balance calculations correct!
  const displayTransactions = [...runningTransactions].reverse();

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        {preferredLanguage === 'hi' ? 'लेन-देन विवरण' : 'Transaction History'}
      </h3>

      <div className="overflow-hidden border border-zinc-150 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-[#121218] shadow-sm">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {displayTransactions.map((tx) => {
            const isCredit = tx.type === 'credit';
            const formattedDate = format(new Date(tx.transaction_date), 'dd MMM yyyy');

            return (
              <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    isCredit 
                      ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400' 
                      : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {isCredit ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                        {isCredit 
                          ? (preferredLanguage === 'hi' ? 'उधार दिया (Credit)' : 'Lent (Credit)') 
                          : (preferredLanguage === 'hi' ? 'जमा मिला (Debit)' : 'Received (Debit)')}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-0.5">
                        <Calendar className="h-3 w-3" /> {formattedDate}
                      </span>
                    </div>
                    {tx.note && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                        <FileText className="h-3 w-3 text-zinc-400" /> {tx.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-sm font-extrabold block ${
                    isCredit ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {isCredit ? '-' : '+'}{formatIndianCurrency(Number(tx.amount))}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-0.5 justify-end">
                    <IndianRupee className="h-2.5 w-2.5" />
                    {preferredLanguage === 'hi' ? 'बैलेंस: ' : 'Balance: '}
                    {formatIndianCurrency(tx.runningBalance)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
