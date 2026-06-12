import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { APP_NAME, APP_NAME_LATIN, APP_TAGLINE } from "@/lib/brand";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n";
import { TournamentProvider } from "@/lib/tournament";
import { Navbar } from "@/components/Navbar";
import { StaffGuard } from "@/components/StaffGuard";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} | ${APP_NAME_LATIN}`,
  description: APP_TAGLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} font-sans`}>
        <LocaleProvider>
          <AuthProvider>
            <TournamentProvider>
              <Navbar />
              <StaffGuard>
                <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                  {children}
                </main>
              </StaffGuard>
            </TournamentProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
