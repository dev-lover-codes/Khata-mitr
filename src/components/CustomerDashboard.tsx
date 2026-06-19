'use client';

import { useState, useEffect } from 'react';
import { formatIndianCurrency } from '@/lib/format';
import { fetchCustomerRelationships } from '@/app/actions/auth';
import LedgerHistory from './LedgerHistory';
import { Store, ArrowLeft, Phone, User } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  role: 'retailer' | 'customer';
  business_name: string | null;
  preferred_language: 'hi' | 'en';
}

interface RetailerRelationship {
  id: string;
  retailer_id: string;
  balance: number;
  retailer: {
    full_name: string;
    phone: string | null;
    business_name: string | null;
  };
}

interface CustomerDashboardProps {
  profile: Profile;
}

export default function CustomerDashboard({ profile }: CustomerDashboardProps) {
  const lang = profile.preferred_language || 'hi';

  const [relationships, setRelationships] = useState<RetailerRelationship[]>([]);
  const [selectedRel, setSelectedRel] = useState<RetailerRelationship | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all customer-retailer relationships
  async function fetchRelationships() {
    setIsLoading(true);
    try {
      const res = await fetchCustomerRelationships(profile.id);
      if (!res.success) throw new Error(res.error);

      const formattedData = (res.data as unknown) as RetailerRelationship[];
      setRelationships(formattedData || []);

      // If a retailer is selected, update it
      if (selectedRel) {
        const updated = formattedData?.find((r) => r.id === selectedRel.id);
        if (updated) {
          setSelectedRel(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching relationships:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRelationships();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // Total balance that this customer owes across all shopkeepers
  const totalOwed = relationships.reduce((acc, curr) => acc + (curr.balance > 0 ? Number(curr.balance) : 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Top Banner Hero Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
            {lang === 'hi' ? 'ग्राहक डैशबोर्ड' : 'Customer Dashboard'}
          </span>
          <h2 className="text-2xl font-black mt-2 leading-none">
            {profile.full_name}
          </h2>
          <p className="text-xs text-emerald-100 mt-1 flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            {lang === 'hi' ? 'अपने सभी दुकानदारों के बकाया बिलों को ट्रैक करें' : 'Track your pending bills across all shops'}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-right border border-white/15">
          <span className="text-[10px] text-emerald-100 font-bold uppercase block">
            {lang === 'hi' ? 'कुल देय (Total Payable)' : 'Total Outstanding'}
          </span>
          <span className="text-2xl font-black">{formatIndianCurrency(totalOwed)}</span>
        </div>
      </div>

      {!selectedRel ? (
        /* ================= LIST OF RETAILERS VIEW ================= */
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
            {lang === 'hi' ? 'आपके सक्रिय खाते' : 'Your Active Accounts'}
          </h3>

          {isLoading && relationships.length === 0 ? (
            <div className="flex justify-center p-8">
              <span className="flex h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : relationships.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-[#121218] rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-sm flex flex-col items-center justify-center">
              <Store className="h-10 w-10 text-zinc-400 mb-2" />
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === 'hi' ? 'कोई खाता लिंक नहीं मिला।' : 'No active ledger relationships found.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {relationships.map((r) => {
                const owesMoney = r.balance > 0;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRel(r)}
                    className="p-5 rounded-2xl bg-white dark:bg-[#121218] border border-zinc-150 dark:border-zinc-800/80 hover:border-emerald-500/40 dark:hover:border-emerald-500/40 shadow-sm hover:shadow transition-all text-left flex justify-between items-center group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-extrabold text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {r.retailer.business_name || r.retailer.full_name}
                      </h4>
                      <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-0.5 mt-0.5">
                        <Store className="h-2.5 w-2.5" /> {r.retailer.full_name}
                      </p>
                      {r.retailer.phone && (
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-0.5">
                          <Phone className="h-2.5 w-2.5" /> {r.retailer.phone}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black block ${
                        owesMoney ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {formatIndianCurrency(Math.abs(r.balance))}
                      </span>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase">
                        {owesMoney 
                          ? (lang === 'hi' ? 'देय है (Payable)' : 'You Owe') 
                          : (lang === 'hi' ? 'अग्रिम है (Paid Extra)' : 'Paid Extra')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= SINGLE LEDGER DETAIL VIEW ================= */
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800/80">
            <button
              onClick={() => setSelectedRel(null)}
              className="text-xs font-bold text-zinc-400 dark:text-zinc-500 hover:text-emerald-600 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{lang === 'hi' ? 'खातों की सूची' : 'Back to Accounts'}</span>
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            
            {/* Retailer Detail Card */}
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-150 dark:border-zinc-800/80 space-y-4">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                  {lang === 'hi' ? 'व्यापारी / दुकान' : 'Retailer / Shop'}
                </span>
                <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-200 mt-1">
                  {selectedRel.retailer.business_name || selectedRel.retailer.full_name}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-1">
                  <User className="h-3 w-3" /> {selectedRel.retailer.full_name}
                </p>
                {selectedRel.retailer.phone && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" /> {selectedRel.retailer.phone}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                  {lang === 'hi' ? 'आपका बकाया' : 'Your Balance'}
                </span>
                <span className={`text-xl font-black block mt-1 ${
                  selectedRel.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatIndianCurrency(Math.abs(selectedRel.balance))}
                </span>
                <span className="text-[9px] text-zinc-400 font-semibold uppercase">
                  {selectedRel.balance > 0 
                    ? (lang === 'hi' ? 'आपको दुकानदार को चुकाने हैं' : 'You paid extra') 
                    : (lang === 'hi' ? 'दुकानदार से वापस लेने हैं' : 'Shopkeeper owes you')}
                </span>
              </div>
            </div>

            {/* Ledger Transactions list */}
            <div className="md:col-span-2">
              <LedgerHistory relationshipId={selectedRel.id} preferredLanguage={lang} />
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
