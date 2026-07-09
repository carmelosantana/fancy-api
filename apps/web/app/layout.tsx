import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Declarative API Platform",
  description: "A self-hostable, read-only queryable API generator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
