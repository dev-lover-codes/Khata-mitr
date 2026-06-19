'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Store, User, Check } from 'lucide-react';

export default function SetupProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState<string>('');
  const [sessionUserPhone, setSessionUserPhone] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'retailer' | 'customer'>('retailer');
  const [businessName, setBusinessName] = useState('');
  const [language, setLanguage] = useState<'hi' | 'en'>('hi');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check auth session
  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Redirect to login if not authenticated
        router.push('/');
      } else {
        setUserId(session.user.id);
        const userPhone = session.user.phone || null;
        setSessionUserPhone(userPhone);
        if (userPhone) {
          setPhone(userPhone);
        } else {
          setPhone('');
        }

        // Check if profile already exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          // If profile exists, redirect to dashboard based on role
          if (profile.role === 'retailer') {
            router.push('/retailer');
          } else {
            router.push('/customer');
          }
        }
      }
    }
    checkSession();
  }, [supabase, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
      setErrorMessage(language === 'hi' ? 'कृपया अपना पूरा नाम दर्ज करें।' : 'Please enter your full name.');
      return;
    }
    if (phone && !/^\+91[6-9]\d{9}$/.test(phone)) {
      setErrorMessage(
        language === 'hi'
          ? 'कृपया एक वैध 10-अंकों का मोबाइल नंबर दर्ज करें।'
          : 'Please enter a valid 10-digit mobile number.'
      );
      return;
    }
    if (role === 'retailer' && !businessName) {
      setErrorMessage(language === 'hi' ? 'कृपया अपने व्यवसाय/दुकान का नाम दर्ज करें।' : 'Please enter your business/shop name.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      if (!userId) throw new Error('No active user session');

      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: fullName,
          phone: phone || null,
          role,
          business_name: role === 'retailer' ? businessName : null,
          preferred_language: language
        });

      if (error) {
        // Handle duplicate key error specifically for user-friendliness
        if (error.code === '23505') {
          throw new Error(
            language === 'hi'
              ? 'यह मोबाइल नंबर पहले से ही किसी अन्य खाते से जुड़ा है।'
              : 'This mobile number is already registered with another account.'
          );
        }
        throw error;
      }

      // Successfully saved, navigate to the correct dashboard page
      if (role === 'retailer') {
        router.push('/retailer');
      } else {
        router.push('/customer');
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Error creating profile';
      setErrorMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0b0f] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-300">
      {/* Background glow animations */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none overflow-hidden opacity-50 dark:opacity-30">
        <div className="absolute top-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-violet-400/30 blur-[100px] dark:bg-violet-600/20" />
        <div className="absolute top-[-5%] right-[20%] w-[250px] h-[250px] rounded-full bg-emerald-400/20 blur-[80px] dark:bg-emerald-600/10" />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#121218] rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-[0_20px_50px_rgba(139,92,246,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden z-10 p-6 space-y-6">
        
        {/* Title branding */}
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center shadow-md shadow-brand-500/20">
            <BookOpen className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {language === 'hi' ? 'खातामित्र प्रोफाइल सेटअप' : 'KhataMitra Profile Setup'}
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand-600 dark:text-brand-400">
              One-Time Setup
            </span>
          </div>
        </div>

        {/* Translation Option */}
        <div className="flex justify-end">
          <button
            onClick={() => setLanguage(language === 'hi' ? 'en' : 'hi')}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
          >
            {language === 'hi' ? 'Change to English' : 'हिंदी में बदलें'}
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-400">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Full Name */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {language === 'hi' ? 'आपका पूरा नाम' : 'Your Full Name'}
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={language === 'hi' ? 'नाम दर्ज करें (उदा. रामू कुमार)' : 'Enter name (e.g., Ramu Kumar)'}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
            />
          </div>

          {/* Phone Number Input */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {language === 'hi' ? 'मोबाइल नंबर (वैकल्पिक, दुकानदार द्वारा खोजने के लिए)' : 'Mobile Number (Optional, for retailer lookup)'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-400 pointer-events-none">
                +91
              </span>
              <input
                type="tel"
                value={phone.startsWith('+91') ? phone.replace('+91', '') : phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, ''); // only digits
                  setPhone(val ? `+91${val}` : '');
                }}
                maxLength={10}
                placeholder={language === 'hi' ? '10-अंकों का मोबाइल नंबर' : '10-digit mobile number'}
                disabled={!!sessionUserPhone}
                className="w-full pl-13 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Role Choice */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {language === 'hi' ? 'अपनी भूमिका चुनें' : 'Choose Your Role'}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('retailer')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  role === 'retailer'
                    ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30'
                }`}
              >
                <Store className={`h-6 w-6 ${role === 'retailer' ? 'text-brand-500' : 'text-zinc-400'}`} />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {language === 'hi' ? 'विक्रेता (व्यापारी)' : 'Retailer (Shopkeeper)'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole('customer')}
                className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  role === 'customer'
                    ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/10'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30'
                }`}
              >
                <User className={`h-6 w-6 ${role === 'customer' ? 'text-brand-500' : 'text-zinc-400'}`} />
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {language === 'hi' ? 'ग्राहक' : 'Customer'}
                </span>
              </button>
            </div>
          </div>

          {/* Business Name (Retailer Only) */}
          {role === 'retailer' && (
            <div className="space-y-1 animate-slide-up">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {language === 'hi' ? 'दुकान या व्यवसाय का नाम' : 'Shop / Business Name'}
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder={language === 'hi' ? 'दुकान का नाम (उदा. राजू प्रोविजन स्टोर)' : 'Enter shop name (e.g., Raju Provision Store)'}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
              />
            </div>
          )}

          {/* Preferred Language */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {language === 'hi' ? 'पसंदीदा भाषा' : 'Preferred Language'}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="preferred_lang"
                  checked={language === 'hi'}
                  onChange={() => setLanguage('hi')}
                  className="accent-brand-500 h-4 w-4"
                />
                <span>हिंदी (Hindi)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="preferred_lang"
                  checked={language === 'en'}
                  onChange={() => setLanguage('en')}
                  className="accent-brand-500 h-4 w-4"
                />
                <span>English (अंग्रेजी)</span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer mt-4"
          >
            {isLoading ? (
              <span className="flex h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>{language === 'hi' ? 'प्रोफ़ाइल सहेजें' : 'Save Profile'}</span>
                <Check className="h-5 w-5" />
              </>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}
