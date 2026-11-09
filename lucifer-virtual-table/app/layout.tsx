import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucifer Virtual Table — Ваша история начинается здесь",
  description: "Виртуальный стол для любых историй: карты, персонажи и универсальные кости.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
