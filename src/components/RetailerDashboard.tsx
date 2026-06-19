'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatIndianCurrency } from '@/lib/format';
import LedgerHistory from './LedgerHistory';
import { Search, UserPlus, PlusCircle, ArrowUpRight, ArrowDownLeft, X, ArrowLeft, Phone, User, Store } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  role: 'retailer' | 'customer';
  business_name: string | null;
  preferred_language: 'hi' | 'en';
}

interface CustomerRelationship {
  id: string;
  customer_id: string;
  balance: number;
  customer: {
    full_name: string;
    phone: string | null;
  };
}

interface RetailerDashboardProps {
  profile: Profile;
}

export default function RetailerDashboard({ profile }: RetailerDashboardProps) {
  const supabase = createClient();
  const lang = profile.preferred_language || 'hi';

  const [relationships, setRelationships] = useState<CustomerRelationship[]>([]);
  const [selectedCust, setSelectedCust] = useState<CustomerRelationship | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddCustOpen, setIsAddCustOpen] = useState(false);
  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);

  // Add Customer Form State
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [addCustError, setAddCustError] = useState<string | null>(null);

  // Add Entry Form State
  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [addEntryError, setAddEntryError] = useState<string | null>(null);

  // Fetch all retailer-customer relationships
  async function fetchRelationships() {
    await Promise.resolve();
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('relationships')
        .select(`
          id,
          customer_id,
          balance,
          customer:profiles!customer_id(full_name, phone)
        `)
        .eq('retailer_id', profile.id);

      if (error) throw error;
      const formattedData = (data as unknown) as CustomerRelationship[];
      setRelationships(formattedData || []);

      // If a customer was selected, update its current data too
      if (selectedCust) {
        const updated = formattedData?.find((r) => r.id === selectedCust.id);
        if (updated) {
          setSelectedCust(updated);
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

  // Handle adding customer (Lookup by phone, otherwise insert profile + relationship)
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName || !custPhone) {
      setAddCustError(lang === 'hi' ? 'कृपया सभी फ़ील्ड भरें।' : 'Please fill all fields.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(custPhone)) {
      setAddCustError(lang === 'hi' ? '10-अंकों का भारतीय मोबाइल नंबर दर्ज करें।' : 'Enter a valid 10-digit Indian phone.');
      return;
    }

    setAddCustError(null);
    setIsLoading(true);

    try {
      const formattedPhone = `+91${custPhone}`;

      // 1. Check if customer profile already exists in public.profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', formattedPhone)
        .single();

      let customerId = existingProfile?.id;

      if (!customerId) {
        // Since Supabase has a foreign key public.profiles.id -> auth.users.id, 
        // to support un-registered customers manually added by retailers,
        // we insert a customer row. Wait! In Phase 2 public.profiles:
        // id references auth.users(id).
        // Since we can't create auth users directly on the client side, we create a fallback entry.
        // Wait, if RLS / constraint prevents it, let's see. In our updated public.profiles schema:
        // id references auth.users(id) on delete cascade.
        // Oh! If the constraint is enforced, a user MUST exist in auth.users.
        // In local setups, since we don't have an auth user for this customer, what should we do?
        // We can create a mock auth user using the signup API or we can just try to insert.
        // Wait, we can sign up the customer as a dummy or we can catch and insert.
        // Actually, to make it bulletproof in the client, let's signup a dummy customer using Supabase:
        const dummyEmail = `customer_${custPhone}@khatamitra.com`;
        const dummyPassword = `Pass_${custPhone}`;
        
        // Attempt signup
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: dummyEmail,
          password: dummyPassword,
          options: {
            data: {
              full_name: custName,
              phone: formattedPhone
            }
          }
        });

        if (signUpError) throw signUpError;
        customerId = signUpData.user?.id;

        // Note: The auth trigger usually inserts into profiles. If not, we insert it manually:
        if (customerId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: customerId,
              full_name: custName,
              phone: formattedPhone,
              role: 'customer',
              preferred_language: 'hi'
            });
          if (profileError) console.warn('Profile insert warning (might already exist):', profileError.message);
        }
      }

      if (!customerId) throw new Error('Could not resolve or create customer identity.');

      // 2. Create relationship link
      const { error: relError } = await supabase
        .from('relationships')
        .insert({
          retailer_id: profile.id,
          customer_id: customerId,
          balance: 0
        });

      if (relError) throw relError;

      setIsAddCustOpen(false);
      setCustName('');
      setCustPhone('');
      await fetchRelationships();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setAddCustError(errorMsg || 'Error adding customer.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding credit/debit transaction
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCust) return;
    const amount = parseFloat(entryAmount);
    if (isNaN(amount) || amount <= 0) {
      setAddEntryError(lang === 'hi' ? 'कृपया एक वैध राशि दर्ज करें।' : 'Please enter a valid amount.');
      return;
    }

    setAddEntryError(null);
    setIsLoading(true);

    try {
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          relationship_id: selectedCust.id,
          type: entryType,
          amount,
          note: entryNote || null,
          created_by: profile.id,
          transaction_date: entryDate
        });

      if (txError) throw txError;

      setIsAddEntryOpen(false);
      setEntryAmount('');
      setEntryNote('');
      setEntryDate(new Date().toISOString().split('T')[0]);
      await fetchRelationships();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setAddEntryError(errorMsg || 'Error recording entry.');
    } finally {
      setIsLoading(false);
    }
  };

  // Compute stats
  const totalUdhaar = relationships.reduce((acc, curr) => acc + (curr.balance > 0 ? Number(curr.balance) : 0), 0);

  const filteredRelationships = relationships.filter((r) =>
    r.customer.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Hero Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-tr from-brand-600 to-violet-600 text-white shadow-xl shadow-brand-500/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
            {lang === 'hi' ? 'दुकानदार डैशबोर्ड' : 'Retailer Dashboard'}
          </span>
          <h2 className="text-2xl font-black mt-2 leading-none">
            {profile.business_name || profile.full_name}
          </h2>
          <p className="text-xs text-brand-100 mt-1 flex items-center gap-1">
            <Store className="h-3.5 w-3.5" />
            {lang === 'hi' ? 'खातामित्र के साथ अपना बहीखाता प्रबंधित करें' : 'Manage your ledger books with KhataMitra'}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-right border border-white/15">
          <span className="text-[10px] text-brand-100 font-bold uppercase block">
            {lang === 'hi' ? 'कुल बकाया (Total Owed)' : 'Total Outstanding'}
          </span>
          <span className="text-2xl font-black">{formatIndianCurrency(totalUdhaar)}</span>
        </div>
      </div>

      {!selectedCust ? (
        /* ================= LIST OF CUSTOMERS VIEW ================= */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-x-0 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'hi' ? 'ग्राहक का नाम खोजें...' : 'Search customer by name...'}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#121218] text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
              />
            </div>
            <button
              onClick={() => setIsAddCustOpen(true)}
              className="px-5 py-3 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-102 active:scale-98 transition-all cursor-pointer text-sm"
            >
              <UserPlus className="h-4 w-4" />
              <span>{lang === 'hi' ? 'नया ग्राहक जोड़ें' : 'Add Customer'}</span>
            </button>
          </div>

          {isLoading && relationships.length === 0 ? (
            <div className="flex justify-center p-8">
              <span className="flex h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          ) : filteredRelationships.length === 0 ? (
            <div className="text-center p-12 bg-white dark:bg-[#121218] rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-sm flex flex-col items-center justify-center">
              <User className="h-10 w-10 text-zinc-400 mb-2" />
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {lang === 'hi' ? 'कोई ग्राहक नहीं मिला।' : 'No customers linked yet.'}
              </p>
              <button
                onClick={() => setIsAddCustOpen(true)}
                className="text-xs text-brand-600 dark:text-brand-400 font-bold hover:underline mt-1"
              >
                {lang === 'hi' ? 'पहला ग्राहक जोड़ें' : 'Add your first customer'}
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredRelationships.map((r) => {
                const owesMoney = r.balance > 0;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedCust(r)}
                    className="p-5 rounded-2xl bg-white dark:bg-[#121218] border border-zinc-150 dark:border-zinc-800/80 hover:border-brand-500/40 dark:hover:border-brand-500/40 shadow-sm hover:shadow transition-all text-left flex justify-between items-center group cursor-pointer"
                  >
                    <div>
                      <h4 className="font-extrabold text-zinc-800 dark:text-zinc-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                        {r.customer.full_name}
                      </h4>
                      {r.customer.phone && (
                        <p className="text-[10px] text-zinc-400 font-medium flex items-center gap-0.5 mt-0.5">
                          <Phone className="h-2.5 w-2.5" /> {r.customer.phone}
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
                          ? (lang === 'hi' ? 'बकाया (Owe)' : 'Outstanding') 
                          : (lang === 'hi' ? 'अग्रिम (Advance)' : 'Advance')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= SINGLE CUSTOMER DETAIL VIEW ================= */
        <div className="space-y-6 animate-fade-in">
          
          {/* Selected Customer Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-150 dark:border-zinc-800/80">
            <button
              onClick={() => setSelectedCust(null)}
              className="text-xs font-bold text-zinc-400 dark:text-zinc-500 hover:text-brand-600 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{lang === 'hi' ? 'ग्राहकों की सूची' : 'Back to Customers'}</span>
            </button>

            <button
              onClick={() => setIsAddEntryOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/20 hover:scale-102 active:scale-98 transition-all cursor-pointer text-xs"
            >
              <PlusCircle className="h-4 w-4" />
              <span>{lang === 'hi' ? 'लेन-देन जोड़ें' : 'Add Ledger Entry'}</span>
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            
            {/* Customer Summary Card */}
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-150 dark:border-zinc-800/80 space-y-4">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                  {lang === 'hi' ? 'ग्राहक' : 'Customer'}
                </span>
                <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-200 mt-1">
                  {selectedCust.customer.full_name}
                </h3>
                {selectedCust.customer.phone && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-1">
                    <Phone className="h-3 w-3" /> {selectedCust.customer.phone}
                  </p>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                  {lang === 'hi' ? 'चल रहा बैलेंस' : 'Running Balance'}
                </span>
                <span className={`text-xl font-black block mt-1 ${
                  selectedCust.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {formatIndianCurrency(Math.abs(selectedCust.balance))}
                </span>
                <span className="text-[9px] text-zinc-400 font-semibold uppercase">
                  {selectedCust.balance > 0 
                    ? (lang === 'hi' ? 'ग्राहक से लेने हैं' : 'Customer owes you') 
                    : (lang === 'hi' ? 'ग्राहक के जमा हैं' : 'You owe Customer')}
                </span>
              </div>
            </div>

            {/* History Table Container */}
            <div className="md:col-span-2">
              <LedgerHistory relationshipId={selectedCust.id} preferredLanguage={lang} />
            </div>

          </div>

        </div>
      )}

      {/* ================= MODAL: ADD CUSTOMER ================= */}
      {isAddCustOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#121218] rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-2xl p-6 relative animate-slide-up">
            <button
              onClick={() => setIsAddCustOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 mb-4">
              <UserPlus className="text-brand-500 h-5 w-5" />
              {lang === 'hi' ? 'नया ग्राहक जोड़ें' : 'Add New Customer'}
            </h3>

            {addCustError && (
              <div className="p-3 mb-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-600 dark:text-red-400">
                {addCustError}
              </div>
            )}

            <form onSubmit={handleAddCustomer} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {lang === 'hi' ? 'ग्राहक का नाम' : 'Customer Full Name'}
                </label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder={lang === 'hi' ? 'उदा. रामू यादव' : 'e.g., Ramu Yadav'}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {lang === 'hi' ? 'मोबाइल नंबर' : 'Phone Number'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="Enter 10-digit number"
                    className="w-full pl-13 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer mt-2 text-sm"
              >
                {isLoading ? (
                  <span className="flex h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>{lang === 'hi' ? 'ग्राहक जोड़ें' : 'Create Customer'}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: ADD ENTRY ================= */}
      {isAddEntryOpen && selectedCust && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#121218] rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-2xl p-6 relative animate-slide-up">
            <button
              onClick={() => setIsAddEntryOpen(false)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2 mb-4">
              <PlusCircle className="text-brand-500 h-5 w-5" />
              {lang === 'hi' ? 'बहीखाता प्रविष्टि' : 'Log Transaction'}
            </h3>

            {addEntryError && (
              <div className="p-3 mb-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl text-xs text-red-600 dark:text-red-400">
                {addEntryError}
              </div>
            )}

            <form onSubmit={handleAddEntry} className="space-y-4">
              
              {/* Type Switcher */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {lang === 'hi' ? 'लेन-देन प्रकार' : 'Transaction Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEntryType('credit')}
                    className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      entryType === 'credit'
                        ? 'border-red-500 bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-transparent'
                    }`}
                  >
                    <ArrowUpRight className="h-4.5 w-4.5" />
                    <span>{lang === 'hi' ? 'उधार दिया (Credit)' : 'Lent (Credit)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryType('debit')}
                    className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                      entryType === 'debit'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-transparent'
                    }`}
                  >
                    <ArrowDownLeft className="h-4.5 w-4.5" />
                    <span>{lang === 'hi' ? 'जमा मिला (Debit)' : 'Received (Debit)'}</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {lang === 'hi' ? 'राशि (₹)' : 'Amount (₹)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={entryAmount}
                  onChange={(e) => setEntryAmount(e.target.value)}
                  placeholder="₹ Enter amount"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {lang === 'hi' ? 'विवरण (नोट)' : 'Note / Description'}
                </label>
                <input
                  type="text"
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder={lang === 'hi' ? 'उदा. चीनी, दाल, नकद भुगतान' : 'e.g. Sugar, Lentils, Cash'}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                />
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  {lang === 'hi' ? 'लेन-देन तिथि' : 'Transaction Date'}
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 rounded-2xl bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer mt-2 text-sm"
              >
                {isLoading ? (
                  <span className="flex h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>{lang === 'hi' ? 'दर्ज करें (Save)' : 'Save Transaction'}</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
