import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TransactionsProvider } from "./context/TransactionsContext";
import { CategoriesProvider } from "./context/CategoriesContext";
import { BudgetsProvider } from "./context/BudgetsContext";
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
  title: "Finance Dashboard",
  description: "A personal finance dashboard",
};

const themeInitScript = `
(function () {
  var stored = localStorage.getItem("theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (stored === "dark" || (!stored && prefersDark)) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <CategoriesProvider>
          <TransactionsProvider>
            <BudgetsProvider>{children}</BudgetsProvider>
          </TransactionsProvider>
        </CategoriesProvider>
      </body>
    </html>
  );
}
