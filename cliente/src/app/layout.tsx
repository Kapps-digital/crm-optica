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
  title: "CRM Óptica",
  description: "Plataforma Integral de Mensajería Omnicanal y Gestión Optométrica",
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
