import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CONFIG } from "../shared/config/catalog";
import "./globals.css";

export const metadata: Metadata = {
  title: CONFIG.appName,
  description: "AI動画生成サービスとローカルエージェントの無料枠を管理するアプリ",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
