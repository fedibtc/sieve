import type { Metadata } from "next";
import { colorModeInitScript } from "@/components/color-mode";
import "./globals.css";

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
      className="h-full font-sans"
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
