import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AuthModal from "@/components/AuthModal";
import CityPicker from "@/components/CityPicker";
import AuthGate from "@/components/auth/AuthGate";
import { AuthProvider } from "@/context/AuthContext";
import { CityProvider } from "@/context/CityContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BookMyShow | Movie tickets",
  description: "Pick a show, choose your seats and get a signed QR ticket. Seats are locked atomically, so no double bookings.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c0c0e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-bg font-sans text-fg antialiased">
        <AuthProvider>
          <AuthGate>
            <CityProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
              <CityPicker />
              <AuthModal />
            </CityProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
