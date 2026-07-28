import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "amasiiuli4ever.com — 12 luni desenate împreună",
  description:
    "Un calendar interactiv în care fiecare lună se deschide și păstrează un desen făcut de voi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
