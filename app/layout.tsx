export const metadata = {
  title: "BodyLab CRM",
  description: "Lead pipeline and WhatsApp CRM for BodyLab",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
