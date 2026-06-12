import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { APP_NAME, APP_NAME_LATIN, APP_TAGLINE, APP_URL } from "@/lib/brand";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { LocaleProvider } from "@/lib/i18n";
import { TournamentProvider } from "@/lib/tournament";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Navbar } from "@/components/Navbar";
import { PwaProvider } from "@/components/PwaProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { StaffGuard } from "@/components/StaffGuard";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${APP_NAME} | ${APP_NAME_LATIN}`,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  metadataBase: new URL(APP_URL),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0C1B33",
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
                <main className="app-main mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                  {children}
                </main>
              </StaffGuard>
              <MobileBottomNav />
              <PwaProvider />
              <ServiceWorkerRegister />
            </TournamentProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
