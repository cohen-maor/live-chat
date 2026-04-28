import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Live Chat",
  description: "Real-time messaging for everyone in the room",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
