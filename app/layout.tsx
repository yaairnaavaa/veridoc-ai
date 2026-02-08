import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PrivyProvider } from "@/components/PrivyProvider";
import { NearProvider } from "@/context/NearContext";
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
  title: "Veridoc | Private AI Blood Test Insights",
  description:
    "Upload blood diagnostics and receive private, medical-grade AI explanations without exposing raw data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PrivyProvider>
          <NearProvider>{children}</NearProvider>
        </PrivyProvider>
      </body>
    </html>
  );
}
