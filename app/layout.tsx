import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Markdown Studio — Convert Markdown to PDF or DOCX",
  description: "Upload a Markdown file and convert it to a properly formatted PDF or Word document, entirely in your browser. Nothing is ever uploaded to a server.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
