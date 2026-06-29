import { Providers } from './providers';
import { Metadata, Viewport } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'Prospector — AI Stock Analysis',
  description: 'AI-powered stock analysis with institutional-grade signals',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Prospector',
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
  themeColor: '#07080A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

const globalStyles = `
  :root {
    --bg: #07080A;
    --bg-card: #111318;
    --bg-card-hover: #161922;
    --bg-elevated: #1A1D26;
    --bg-input: #0D0F14;
    --text-primary: #F1F5F9;
    --text-secondary: #94A3B8;
    --text-muted: #64748B;
    --accent: #7C3AED;
    --accent-light: #8B5CF6;
    --accent-dark: #6D28D9;
    --positive: #10B981;
    --negative: #EF4444;
    --warning: #F59E0B;
    --info: #06B6D4;
    --border: #1E2230;
    --border-light: #272B3A;
    --divider: #1A1E2A;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
  }

  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    -webkit-tap-highlight-color: transparent;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: #07080A;
    color: #F1F5F9;
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

  * {
    box-sizing: border-box;
  }

  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: #272B3A;
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: #3B3F52;
  }

  @supports (-webkit-touch-callout: none) {
    html, body, #__next {
      height: -webkit-fill-available;
    }
    input, textarea {
      font-size: 16px !important;
      -webkit-user-select: text;
      user-select: text;
    }
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        <Providers>
          <Suspense fallback={<div style={{ minHeight: '100vh', background: '#07080A' }} />}>
            {children}
          </Suspense>
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
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
