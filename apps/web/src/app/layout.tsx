import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "FUTU 延展平台",
  applicationName: "FUTU 延展平台",
  description: "识别 Figma 母版、批量延展资源位与修改文案",
  icons: {
    icon: "/brand/platform-favicon.png?v=7",
    apple: "/brand/platform-icon-transparent.png?v=2",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <body className="h-full overflow-hidden">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
