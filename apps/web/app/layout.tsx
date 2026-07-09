import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fancy — paste data, get a fancy API",
  description:
    "Paste a table, get a live queryable REST API in seconds — plus an MCP endpoint AI agents can write to. Self-hostable.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-canvas font-sans text-[15px] text-white antialiased">
        <div className="app-backdrop" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
