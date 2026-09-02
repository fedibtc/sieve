import type { Metadata } from "next";
import { Mona_Sans } from "next/font/google";
import { colorModeInitScript } from "@/components/color-mode";
import "./globals.css";

const monaSans = Mona_Sans({
  variable: "--font-mona-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "sieve",
  description: "Review recaps and feedback loops for agent-authored changes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${monaSans.variable} h-full font-sans antialiased`}
      data-color-mode="auto"
      suppressHydrationWarning
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static script, no user input */}
        <script dangerouslySetInnerHTML={{ __html: colorModeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
