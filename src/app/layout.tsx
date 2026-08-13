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
        {/* Catch `beforeinstallprompt` before React exists.

            Chrome fires it once, as soon as it decides the app is
            installable, and that can easily be BEFORE hydration finishes on a
            mid-range phone. A listener registered in a useEffect misses it and
            there is no way to ask for it again, which is why "Get app" showed
            on a laptop and never appeared on the phone. Stashing it here, in a
            script that runs while the page is still parsing, means the button
            can pick it up whenever it mounts. See src/core/pwa/install.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){window.__eendragInstallPrompt=null;function s(v){window.__eendragInstallPrompt=v;window.dispatchEvent(new Event("eendrag:installable"))}window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();s(e)});window.addEventListener("appinstalled",function(){s(null)})})();`,
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
