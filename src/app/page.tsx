'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { translations } from '@/lib/translations';
import { Language } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import LanguageToggle from '@/components/LanguageToggle';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '@/app/actions/auth';
import { BookOpen, ArrowRight, Sparkles, Shield, AlertCircle, Lock, Mail, Loader2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';



export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  const [session, setSession] = useState<Session | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  // Language state
  const [language, setLanguage] = useLocalStorage<Language>('khata-lang', 'en');
  const t = translations[language] || translations.en;

  // Form inputs & login flow state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Fetch profiles table record
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        // If profile doesn't exist, route to setup-profile
        router.push('/setup-profile');
      } else {
        // Redirect to appropriate dashboard based on role
        if (data.role === 'retailer') {
          router.push('/retailer');
        } else {
          router.push('/customer');
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setAppLoading(false);
    }
  }, [supabase, router]);

  // Listen to Auth State Changes
  useEffect(() => {
    async function checkAuth() {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession) {
        await fetchProfile(currentSession.user.id);
      } else {
        setAppLoading(false);
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      if (currentSession) {
        await fetchProfile(currentSession.user.id);
      } else {
        setAppLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  // Handle Google OAuth Auth Flow
  const handleGoogleAuth = async () => {
    setAuthError(null);
    setIsLoading(true);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const res = await signInWithGoogle(origin);
      if (res && !res.success) {
        setAuthError(res.error || 'Google login failed.');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Email/Password Login & Signup Form
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError(t.emailRequired || 'Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setAuthError(t.passwordLengthError || 'Password must be at least 6 characters.');
      return;
    }

    setAuthError(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const res = await signUpWithEmail(email, password);
        if (res.success) {
          setAuthError(
            language === 'hi'
              ? 'खाता बनाया गया है! यदि ईमेल सत्यापन सक्षम है, तो कृपया अपनी ईमेल की जांच करें, अन्यथा सीधे लॉग इन करें।'
              : 'Account created! If email confirmation is enabled, please verify your email; otherwise, sign in directly.'
          );
          setIsSignUp(false);
        } else {
          setAuthError(res.error || 'Signup failed.');
        }
      } else {
        const res = await signInWithEmail(email, password);
        if (res.success) {
          router.refresh();
        } else {
          setAuthError(res.error || 'Login failed.');
        }
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsLoading(false);
    }
  };

  if (appLoading || session) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0b0f] flex flex-col items-center justify-center p-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        <p className="text-xs text-zinc-400 mt-3 font-semibold">KhataMitra Loading...</p>
      </div>
    );
  }

  /* ================= LANDING / AUTHENTICATION VIEW ================= */
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#0b0b0f] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 transition-colors duration-300">
      
      {/* Glow decorations */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[400px] pointer-events-none overflow-hidden opacity-50 dark:opacity-30">
        <div className="absolute top-[-10%] left-[20%] w-[300px] h-[300px] rounded-full bg-violet-400/30 blur-[100px] dark:bg-violet-600/20" />
        <div className="absolute top-[-5%] right-[20%] w-[250px] h-[250px] rounded-full bg-emerald-400/20 blur-[80px] dark:bg-emerald-600/10" />
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#121218] rounded-3xl border border-zinc-150 dark:border-zinc-800/80 shadow-[0_20px_50px_rgba(139,92,246,0.06)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col z-10 animate-slide-up">
        
        {/* Header */}
        <header className="p-6 pb-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <BookOpen className="h-5.5 w-5.5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
                {t.title}
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand-600 dark:text-brand-400">
                AI Ledger
              </span>
            </div>
          </div>
          <LanguageToggle language={language} setLanguage={setLanguage} />
        </header>

        {/* Hero & Forms */}
        <main className="flex-1 p-6 flex flex-col">
          <div className="text-center sm:text-left mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2 leading-tight">
              {t.subtitle}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {t.tagline}
            </p>
          </div>

          {authError && (
            <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Google Sign-in Button */}
            <button
              type="button"
              disabled={isLoading}
              onClick={handleGoogleAuth}
              className="w-full py-3.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white hover:bg-zinc-50 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/50 text-zinc-700 dark:text-zinc-200 font-bold flex items-center justify-center gap-2 shadow-sm hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              ) : (
                <svg className="h-5 w-5 mr-1 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
              )}
              <span>{t.signInWithGoogle}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center my-4">
              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800"></div>
              <span className="px-3 text-xs font-bold text-zinc-400 uppercase tracking-widest">{t.orDivider}</span>
              <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {t.emailLabel}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.emailPlaceholder}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 mt-2"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? t.signUpButton : t.signInButton}</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setAuthError(null);
                  }}
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                >
                  {isSignUp ? t.alreadyHaveAccount : t.dontHaveAccount}
                </button>
              </div>
            </form>
          </div>

          {/* Core App Features Info */}
          <div className="grid grid-cols-2 gap-3 pt-6 mt-6 border-t border-zinc-150 dark:border-zinc-800/85">
            <div className="flex gap-2 items-start">
              <Sparkles className="h-4.5 w-4.5 text-brand-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{t.aiFeatureTitle}</h4>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight">
                  {language === 'en' ? 'Voice + Text logging' : 'आवाज + टेक्स्ट दर्ज करें'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-start">
              <Shield className="h-4.5 w-4.5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">{t.secureStorageTitle}</h4>
                <p className="text-[9px] text-zinc-400 dark:text-zinc-500 leading-tight">
                  {language === 'en' ? 'Supabase secured' : 'सुपाबेस द्वारा सुरक्षित'}
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-150 dark:border-zinc-800/60 text-center">
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {t.footerText}
          </p>
        </footer>
      </div>
    </div>
  );
}
