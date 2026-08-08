import './globals.css';

export const metadata = {
  title: 'Sarvam Associates',
  description: 'Sarvam Associates — mutual-fund assistant and service desk.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // enables env(safe-area-inset-*) on notched phones
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
