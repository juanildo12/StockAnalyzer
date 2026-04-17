import { Providers } from './providers';
import { Metadata, Viewport } from 'next';
import { Suspense } from 'react';

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

const globalStyles = `
  html, body {
    height: 100%;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    -webkit-tap-highlight-color: transparent;
  }
  
  body {
    overscroll-behavior-y: none;
  }
  
  input, textarea, select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border-radius: 0;
    -webkit-border-radius: 0;
  }
  
  input:focus, textarea:focus, select:focus {
    outline: none;
    -webkit-appearance: none;
  }
  
  /* iOS PWA specific fixes */
  @supports (-webkit-touch-callout: none) {
    html, body, #__next {
      height: -webkit-fill-available;
    }
    
    input, textarea {
      font-size: 16px !important;
      -webkit-user-select: text;
      user-select: text;
    }
    
    .search-input {
      position: relative;
      z-index: 9999 !important;
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
    
    /* Ensure inputs are always on top */
    input[type="text"],
    input[type="search"],
    input[type="email"],
    input[type="number"],
    textarea {
      position: relative !important;
      z-index: 9999 !important;
      -webkit-transform: translateZ(0);
      transform: translateZ(0);
    }
  }
  
  /* Prevent iOS from zooming on input focus */
  @media screen and (max-width: 768px) {
    input, select, textarea {
      font-size: 16px !important;
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
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0d1117' }} />}>
            {children}
          </Suspense>
        </Providers>
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
              
              // Ensure proper viewport
              const meta = document.querySelector('meta[name="viewport"]');
              if (meta) {
                let content = meta.getAttribute('content') || '';
                if (!content.includes('viewport-fit=cover')) {
                  content += ', viewport-fit=cover';
                  meta.setAttribute('content', content);
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
