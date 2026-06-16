import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "SyncFlow - Durable AI Workflow Builder",
  description:
    "Build approval-critical AI workflows with local demo execution, human review, eval gates, audit trails, and an optional Temporal production backend.",
  keywords:
    "AI workflow, durable execution, approvals, evals, audit trail, Temporal, workflow builder, enterprise AI",
  authors: [{ name: "Sandip Pathe" }],
  openGraph: {
    title: "SyncFlow - Durable AI Workflow Builder",
    description: "Approval-critical AI workflow builder with local demo mode",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "SyncFlow - Durable AI Workflow Builder",
    description: "Build approval-critical AI workflows with visible trust gates",
  },
  robots: {
    index: true,
    follow: true,
  },
  metadataBase: new URL("https://syncflow.local"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
