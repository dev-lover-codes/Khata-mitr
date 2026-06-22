'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
      } else if (data.session) {
        // Successful login, redirect to dashboard/home page
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during sign in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[500px] h-[500px] rounded-full bg-pink-500/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-md z-10">
        {/* Branding Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-white text-2xl font-black tracking-tight">PM</span>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-[#111622] rounded-2xl border border-zinc-800/80 p-8 sm:p-10 shadow-2xl shadow-black/40 backdrop-blur-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
              Sign in to your account
            </h2>
            <p className="mt-2 text-sm text-zinc-400">
              Or{' '}
              <Link href="/signup" className="font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
                start your 14-day free trial
              </Link>
            </p>
          </div>

          {/* Feedback states */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-sm text-red-400 animate-fade-in">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                Email address
              </label>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  className="pl-11 block w-full rounded-xl border border-zinc-800 bg-[#070A0F] py-3 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    // Optional: Link to a password reset flow, or do nothing as it's a mock action
                  }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 tracking-wide transition-colors"
                >
                  Forgot your password?
                </a>
              </div>
              <div className="relative mt-1.5">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="pl-11 block w-full rounded-xl border border-zinc-800 bg-[#070A0F] py-3 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Remember me row */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                  className="h-4 w-4 rounded border-zinc-800 bg-[#070A0F] text-indigo-600 focus:ring-indigo-500/20 focus:ring-offset-0 focus:ring-offset-transparent accent-indigo-600 cursor-pointer disabled:opacity-50"
                />
                <label htmlFor="remember-me" className="ml-2.5 block text-sm text-zinc-400 cursor-pointer select-none">
                  Remember me
                </label>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-[#6366F1] hover:bg-[#5053E3] text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/35 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 group"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  Sign in
                  <span className="font-mono transition-transform duration-200 group-hover:translate-x-1">→</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
