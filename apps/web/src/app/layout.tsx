import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sreedhareeyam PRM",
  description: "Patient Relationship Management platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
