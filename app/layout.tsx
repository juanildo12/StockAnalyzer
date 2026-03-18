import { Providers } from './providers';

export const metadata = {
  title: 'Stock Analyzer',
  description: 'Analiza acciones de EE.UU. con inteligencia artificial',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
