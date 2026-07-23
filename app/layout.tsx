import { Providers } from './providers';
import { ThemeProvider } from '@/src/components/ThemeProvider';
import ThemeWrapper from '@/src/components/ThemeWrapper';
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
  themeColor: '#0A0B0E',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const globalStyles = `
  :root {
    --bg: #0A0B0E;
    --bg-card: #12141A;
    --bg-card-hover: #181B24;
    --bg-elevated: #1E212B;
    --bg-input: #0E1015;
    --text-primary: #E8EAF0;
    --text-secondary: #8B90A5;
    --text-muted: #555A70;
    --accent: #2DD4BF;
    --accent-light: #5EEAD4;
    --accent-dark: #14B8A6;
    --positive: #34D399;
    --negative: #FB7185;
    --warning: #FBBF24;
    --info: #67E8F9;
    --border: #1C1F2A;
    --border-light: #23263A;
    --divider: #181B24;
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;
  }

  [data-theme="light"] {
    --bg: #F4F5F0;
    --bg-card: #FFFFFF;
    --bg-card-hover: #FAFAF8;
    --bg-elevated: #ECEEE8;
    --bg-input: #FFFFFF;
    --text-primary: #1A1C22;
    --text-secondary: #555A70;
    --text-muted: #8B90A5;
    --accent: #0D9488;
    --accent-light: #14B8A6;
    --accent-dark: #0F766E;
    --positive: #059669;
    --negative: #E11D48;
    --warning: #D97706;
    --info: #0891B2;
    --border: #E0E2DA;
    --border-light: #E8EAE3;
    --divider: #E8EAE3;
  }

  html, body {
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    -webkit-tap-highlight-color: transparent;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text-primary);
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

  button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: transparent;
  }

  button:hover {
    background-color: inherit;
  }

  input:focus, textarea:focus, select:focus {
    outline: none;
    -webkit-appearance: none;
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
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
    background: var(--border-light);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
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

  /* ═══ Micro-animations ═══ */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeInScale {
    from { opacity: 0; transform: scale(0.97); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes scoreFill {
    from { width: 0%; }
  }
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes staggerChild {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes countUp {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseSoft {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 8px rgba(45, 212, 191, 0); }
    50% { box-shadow: 0 0 20px rgba(45, 212, 191, 0.15); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scalePress {
    0% { transform: scale(1); }
    50% { transform: scale(0.97); }
    100% { transform: scale(1); }
  }
  @keyframes shimmerModern {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes skeletonPulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
  @keyframes verdictReveal {
    0% { opacity: 0; transform: scale(0.9); }
    50% { transform: scale(1.05); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes ripple {
    to { transform: scale(4); opacity: 0; }
  }
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: globalStyles }} />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme');
            if (t) document.documentElement.setAttribute('data-theme', t);
          })();
        `}} />
      </head>
      <body>
        <ThemeProvider>
          <Providers>
            <ThemeWrapper>
              <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
                {children}
              </Suspense>
            </ThemeWrapper>
          </Providers>
        </ThemeProvider>
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
