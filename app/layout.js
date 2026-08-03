import './globals.css';

export const metadata = {
  title: 'Sarvam Associates',
  description: 'Sarvam Associates — mutual-fund assistant and service desk.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
