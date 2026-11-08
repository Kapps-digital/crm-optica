import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--fuente-cuerpo",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--fuente-titulos",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fokaly",
  description: "Fokaly - Plataforma Integral de Mensajería Omnicanal y Gestión Optométrica",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icono-notificacion-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icono-app-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fokaly",
  },
};

export default function LayoutRaiz({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" data-tema="claro" className={`${inter.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
