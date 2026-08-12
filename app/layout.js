import "./globals.css";

export const metadata = {
  title: "ShiftCtrl",
  description: "Registre de service — shifts et salaire",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ShiftCtrl",
  },
};

export const viewport = {
  themeColor: "#121317",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
