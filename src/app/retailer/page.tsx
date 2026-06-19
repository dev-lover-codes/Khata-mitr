'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import RetailerDashboard from '@/components/RetailerDashboard';
import ChatAssistant from '@/components/ChatAssistant';
import LanguageToggle from '@/components/LanguageToggle';
import { BookOpen, LogOut, Loader2 } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Language } from '@/types';

interface Profile {
  id: string;
  full_name: string;
  role: 'retailer' | 'customer';
  business_name: string | null;
  preferred_language: 'hi' | 'en';
}

export default function RetailerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useLocalStorage<Language>('khata-lang', 'en');
  const t = translations[language] || translations.en;

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error || !userProfile) {
        router.push('/setup-profile');
        return;
      }

      if (userProfile.role !== 'retailer') {
        router.push('/customer');
        return;
      }

      setProfile(userProfile);
      setLoading(false);
    }

    checkAuth();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading || !profile) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0b0f] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        <p className="text-xs text-zinc-400 mt-3 font-semibold">Loading Retailer Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0b0f] text-zinc-800 dark:text-zinc-200 transition-colors duration-300">
      
      {/* Dashboard Navbar */}
      <nav className="sticky top-0 bg-white/80 dark:bg-[#121218]/80 backdrop-blur-md border-b border-zinc-150 dark:border-zinc-800/80 z-40 p-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center text-white font-bold">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="font-extrabold tracking-tight text-zinc-900 dark:text-white">{t.title}</span>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageToggle language={language} setLanguage={setLanguage} />
            
            <button
              onClick={handleSignOut}
              className="p-2 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-950 transition-colors cursor-pointer"
              title={language === 'hi' ? 'लॉग आउट' : 'Sign Out'}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Dashboard Body */}
      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
        <RetailerDashboard profile={profile} />
      </main>

      {/* Floating Chat Assistant Widget */}
      <ChatAssistant profile={profile} />
    </div>
  );
}
