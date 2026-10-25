import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { APP_NAME, BRAND_ASSETS, BRAND_COLOR } from "@/lib/brand";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Las páginas exportan solo su nombre: "Contactos" → "Contactos · LG Blocks CRM".
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Bandeja de mensajes de WhatsApp Business",
  applicationName: APP_NAME,
  // src/app/favicon.ico se declara solo; aquí van los PNG de public/brand.
  icons: {
    icon: [{ url: BRAND_ASSETS.favicon32, sizes: "32x32", type: "image/png" }],
    apple: [{ url: BRAND_ASSETS.appleTouch, sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: BRAND_COLOR,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes añade la clase .dark antes de hidratar.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="top-right" richColors={false} closeButton />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
