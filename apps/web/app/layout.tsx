import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Drapnr — Your Digital Wardrobe",
  description:
    "Capture outfits in 360°, organize your wardrobe digitally, and mix & match pieces on your 3D avatar. Never wonder what to wear again.",
  keywords: ["wardrobe", "fashion", "3D avatar", "outfit planner", "digital closet"],
  openGraph: {
    title: "Drapnr — Your Digital Wardrobe",
    description:
      "Capture outfits in 360°, organize your wardrobe digitally, and mix & match on your 3D avatar.",
    type: "website",
    url: "https://drapnr.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Drapnr — Your Digital Wardrobe",
    description:
      "Capture outfits in 360°, organize your wardrobe digitally, and mix & match on your 3D avatar.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-white font-sans antialiased">{children}</body>
    </html>
  );
}
