import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
  title: "Live2D Face Tracker",
  description: "Webcam face tracking with Live2D on browser",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Live2D Cubism Core must be loaded before pixi-live2d-display */}
        <Script src="/lib/live2dcubismcore.min.js" strategy="beforeInteractive" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
