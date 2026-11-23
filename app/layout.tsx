import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: { default: "Cristina's Decorações", template: "%s · Cristina's" },
  description: "Sistema de gestão da Cristina's Decorações",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f6f2eb" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "!bg-tinta !text-white !border-0 !rounded-[10px] !font-sans !text-sm !font-bold",
              error: "!bg-perigo",
            },
          }}
        />
      </body>
    </html>
  );
}
