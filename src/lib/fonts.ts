import localFont from "next/font/local";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";

// General Sans (Fontshare) — self-hosted para evitar el round-trip bloqueante a
// api.fontshare.com (~1.4s en móvil según Lighthouse).
export const generalSans = localFont({
  src: [
    { path: "../fonts/general-sans/general-sans-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/general-sans/general-sans-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/general-sans/general-sans-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/general-sans/general-sans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-general-sans",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
  preload: true,
});

export const fontVariables = `${generalSans.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`;
