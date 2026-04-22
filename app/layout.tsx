import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "梁山 Cyber Arena",
  description:
    "Next.js + Tailwind + Framer Motion + React Three Fiber powered Chinese cyberpunk Water Margin 108 heroes roster and duel arena.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full font-sans text-slate-100">{children}</body>
    </html>
  );
}
