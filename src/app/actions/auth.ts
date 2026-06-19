'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function signInWithPhone(phone: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

export async function verifyPhoneOtp(phone: string, token: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token,
      type: 'sms',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

// Fallback password login for local testing
export async function signInWithEmail(email: string, password: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, session: data.session, user: data.user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

// Fallback signup for local testing
export async function signUpWithEmail(email: string, password: string) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown auth error' };
  }
}

export async function signInWithGoogle(redirectToOrigin: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${redirectToOrigin}/auth/callback`,
    },
  });

  if (error) {
    return { success: false, error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }

  return { success: false, error: 'OAuth redirect URL not generated.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}

export async function adminCreateCustomer(name: string, phone: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!serviceRoleKey) {
      return { success: false, error: 'SERVICE_ROLE_KEY_MISSING' };
    }

    const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const cleanPhone = phone.replace('+', '');
    const dummyEmail = `customer_${cleanPhone}@gmail.com`;
    const dummyPassword = `Pass_${cleanPhone}`;

    const { data, error } = await adminClient.auth.admin.createUser({
      email: dummyEmail,
      password: dummyPassword,
      email_confirm: true, // auto-confirms email so no verification email is sent!
      user_metadata: {
        full_name: name,
        phone: phone
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, userId: data.user?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown admin auth error' };
  }
}

