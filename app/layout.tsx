import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import {
  APP_BACKGROUND_COLOR,
  APP_DESCRIPTION,
  APP_NAME,
  APP_THEME_COLOR,
  APPLE_SPLASH,
  appleSplashMedia,
} from "@/lib/pwa";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteMetadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ["WatchNext", "movies", "TV", "recommendations", "watch party"],
  category: "entertainment",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    // Opaque. `black-translucent` always frosts the status-bar band on iOS.
    statusBarStyle: "black",
    title: APP_NAME,
    startupImage: APPLE_SPLASH.flatMap((spec) => [
      {
        url: `/splash/apple-splash-${spec.width}x${spec.height}.png`,
        media: appleSplashMedia(spec, "portrait"),
      },
      {
        url: `/splash/apple-splash-${spec.width}x${spec.height}.png`,
        media: appleSplashMedia(spec, "landscape"),
      },
    ]),
  },
  // Next 16 maps appleWebApp.capable to mobile-web-app-capable only.
  // iOS Add to Home Screen still expects the apple-prefixed meta.
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": APP_THEME_COLOR,
    "msapplication-TileImage": "/icons/icon-144.png",
    "msapplication-config": "/browserconfig.xml",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "apple-touch-icon-precomposed", url: "/apple-touch-icon-precomposed.png" },
      { rel: "mask-icon", url: "/safari-pinned-tab.svg", color: APP_THEME_COLOR },
    ],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: APP_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
    images: ["/twitter-image.png"],
  },
  manifest: "/manifest.webmanifest",
};

export const metadata: Metadata = siteMetadata;

export const viewport: Viewport = {
  // Match the app field so iOS standalone does not wash a purple band over the header.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: APP_BACKGROUND_COLOR },
    { media: "(prefers-color-scheme: light)", color: APP_BACKGROUND_COLOR },
  ],
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full min-h-full bg-background font-sans text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
