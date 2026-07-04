import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "X Bookmarks",
  description: "Tus bookmarks de X/Twitter, guardados y buscables",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
