'use client';

import { Toaster } from '@/components/ui/toaster';
import { UserModeProvider } from '@/contexts/user-mode';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <UserModeProvider>
      {children}
      <Toaster />
    </UserModeProvider>
  );
}
