import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";

export const metadata: Metadata = {
  title: "Aura Engine - AI Mockup Generator",
  description: "AI-powered creative tool for designers and product creators",
  icons: {
    icon: "/heart.png",
    shortcut: "/heart.png",
    apple: "/heart.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/heart.png?v=3" type="image/png" />
        <link rel="shortcut icon" href="/heart.png?v=3" type="image/png" />
        <link rel="apple-touch-icon" href="/heart.png?v=3" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
