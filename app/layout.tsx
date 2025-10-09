import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
    title: "Next.js and Supabase Starter Kit",
    description: "The fastest way to build apps with Next.js and Supabase",
};

const geistSans = Geist({
    variable: "--font-geist-sans",
    display: "swap",
    subsets: ["latin"],
});

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr" className="h-full" suppressHydrationWarning>
            <body
                suppressHydrationWarning
                className={`${geistSans.variable} antialiased font-sans min-h-screen dark:bg-zinc-950 bg-zinc-50`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="system"
                    enableSystem
                    disableTransitionOnChange
                >
                    <RootProvider>
                        {children}
                        <Toaster />
                    </RootProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
