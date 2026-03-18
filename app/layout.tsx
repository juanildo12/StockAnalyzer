import { Providers } from './providers';
import { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Stock Analyzer',
  description: 'Analiza acciones de EE.UU. con inteligencia artificial',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StockAnalyzer',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1117',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

const iosPwaFixStyles = `
  html, body {
    height: 100%;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  input, textarea {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 0;
  }
  
  input:focus, textarea:focus {
    -webkit-appearance: none;
    outline: none;
  }
  
  @supports (-webkit-touch-callout: none) {
    input, textarea {
      font-size: 16px !important;
    }
  }
  
  @supports (-webkit-touch-callout: none) {
    .search-input:focus {
      position: relative;
      z-index: 9999;
    }
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: iosPwaFixStyles }} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('ServiceWorker registration successful');
                    },
                    function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    }
                  );
                });
              }
              
              // Fix for iOS PWA input zoom issue
              const meta = document.querySelector('meta[name="viewport"]');
              if (meta) {
                const content = meta.getAttribute('content') || '';
                if (!content.includes('viewport-fit=cover')) {
                  meta.setAttribute('content', content + ', viewport-fit=cover');
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
