import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '';

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && session) {
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      // Check if user profile exists in profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        // Redirect to one-time setup-profile if profile records do not exist yet
        return NextResponse.redirect(`${origin}/setup-profile`);
      }
      if (profile.role === 'retailer') {
        return NextResponse.redirect(`${origin}/retailer`);
      } else {
        return NextResponse.redirect(`${origin}/customer`);
      }
    }
  }

  // Redirect back to home with an error parameter if auth exchange fails
  return NextResponse.redirect(`${origin}/?error=auth_failed`);
}
