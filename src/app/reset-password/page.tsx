'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { translations } from '@/lib/translations';
import { Language } from '@/types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import LanguageToggle from '@/components/LanguageToggle';
import { BookOpen, ArrowRight, Sparkles, Shield, AlertCircle, Lock, Loader2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  // Language state
  const [language, setLanguage] = useLocalStorage<Language>('khata-lang', 'en');
  const t = translations[language] || translations.en;

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setAuthError(language === 'hi' ? 'सभी फील्ड आवश्यक हैं।' : 'All fields are required.');
      return;
    }

    if (password.length < 6) {
      setAuthError(t.passwordLengthError);
      return;
    }

    if (password !== confirmPassword) {
      setAuthError(t.passwordsDoNotMatch);
      return;
    }

    setAuthError(null);
    setAuthSuccess(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setAuthError(error.message);
      } else {
        setAuthSuccess(t.passwordResetSuccess);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'An error occurred during password update.');
    } finally {
      setIsLoading(false);
    }
  };

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
              {t.resetPasswordTitle}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {language === 'en' ? 'Create a secure new password for your account.' : 'अपने खाते के लिए एक नया सुरक्षित पासवर्ड बनाएं।'}
            </p>
          </div>

          {authError && (
            <div className="p-3 mb-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && (
            <div className="p-3 mb-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{authSuccess}</span>
            </div>
          )}

          <div className="space-y-4">
            {authSuccess ? (
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer mt-2"
              >
                <span>{t.backToSignIn}</span>
                <ArrowRight className="h-5 w-5" />
              </button>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-3">
                  {/* New Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      {t.newPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t.newPasswordPlaceholder}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition-all text-zinc-800 dark:text-zinc-200"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      {t.confirmPasswordLabel}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t.confirmPasswordPlaceholder}
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
                      <span>{t.updatePasswordButton}</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => router.push('/')}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                  >
                    {t.backToSignIn}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Features footer info */}
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
