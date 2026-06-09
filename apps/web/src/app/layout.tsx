import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// Andromeda's primary typeface.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sreedhareeyam PRM",
  description: "Patient Relationship Management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>{children}</body>
    </html>
  );
}
