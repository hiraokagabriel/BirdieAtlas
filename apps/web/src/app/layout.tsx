import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { UserModeProvider } from "@/contexts/user-mode";

export const metadata: Metadata = {
  title: "BirdieAtlas",
  description: "Protótipo de gestão de campeonatos de badminton",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <UserModeProvider>
          <AppShell>{children}</AppShell>
        </UserModeProvider>
      </body>
    </html>
  );
}
