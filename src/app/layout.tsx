import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zoom-lite — video calls",
  description: "Simple peer-to-peer video calling for up to 4 people.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
