import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Quiet Reader", description: "A private, local-first reading library.", applicationName: "Quiet Reader" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#111318" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
