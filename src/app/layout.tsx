import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/core/ui/theme";
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
  title: {
    default: "Eendrag",
    template: "%s · Eendrag",
  },
  description: "The official app of Eendrag residence, Stellenbosch",
  applicationName: "Eendrag",
  icons: {
    // iOS ignores the manifest's icons and uses this one for the home screen.
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Eendrag",
    // "default" keeps the status bar legible against the maroon bar; "black-
    // translucent" would slide the page up underneath it.
    statusBarStyle: "default",
  },
};

// The colour iOS and Android paint around the app once it is installed —
// the maroon bar in the light, near-black in the dark, so the phone's own
// chrome matches the header instead of flashing white.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#5c1220" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0c0b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes writes the theme class onto <html>
    // before React hydrates, so the server and client markup differ by design.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
