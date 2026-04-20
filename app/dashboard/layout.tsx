import { redirect } from 'next/navigation';
import { createSessionClient } from '@/lib/supabase/server-session';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return <>{children}</>;
}
