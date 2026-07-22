'use client';

import { useState, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { colors as C, radius as R, font as F, spacing as S } from '@/src/utils/webTheme';

interface ShareScreenshotModalProps {
  targetRef: React.RefObject<HTMLElement | null>;
  symbol: string;
  onClose: () => void;
}

export default function ShareScreenshotModal({ targetRef, symbol, onClose }: ShareScreenshotModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const generate = useCallback(async () => {
    if (!targetRef.current) {
      setError(true);
      setGenerating(false);
      return;
    }
    try {
      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: C.bg,
      });
      setImageUrl(dataUrl);
    } catch {
      setError(true);
    } finally {
      setGenerating(false);
    }
  }, [targetRef]);

  useEffect(() => { generate(); }, [generate]);

  const download = useCallback(() => {
    if (!imageUrl) return;
    setDownloading(true);
    const link = document.createElement('a');
    link.download = `${symbol}_analysis.png`;
    link.href = imageUrl;
    link.click();
    setTimeout(() => setDownloading(false), 800);
  }, [imageUrl, symbol]);

  const copyToClipboard = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        await navigator.clipboard.writeText(imageUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* silent */ }
    }
  }, [imageUrl]);

  const shareNative = useCallback(async () => {
    if (!imageUrl) return;
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const file = new File([blob], `${symbol}_analysis.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `Análisis de ${symbol} — Prospector Research` });
      } else {
        download();
      }
    } catch {
      download();
    }
  }, [imageUrl, symbol, download]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.title}>📸 Compartir análisis</div>
            <div style={styles.subtitle}>{symbol} — Prospector Research</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Preview */}
        <div style={styles.previewArea}>
          {generating ? (
            <div style={styles.placeholder}>
              <div style={styles.spinner} />
              <span style={{ color: C.textMuted, fontSize: F.sizeSm }}>Generando imagen...</span>
            </div>
          ) : error ? (
            <div style={styles.placeholder}>
              <span style={{ fontSize: '32px' }}>⚠️</span>
              <span style={{ color: C.negative, fontSize: F.sizeSm }}>Error al generar la imagen</span>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt={`Análisis ${symbol}`} style={styles.cardImage} />
          ) : null}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button onClick={onClose} style={styles.cancelBtn}>Cancelar</button>

          <button
            onClick={copyToClipboard}
            disabled={!imageUrl}
            style={{
              ...styles.actionBtn,
              background: copied ? `${C.positive}20` : 'transparent',
              border: `1px solid ${copied ? C.positive : C.border}`,
              color: copied ? C.positive : C.textSecondary,
            }}
          >
            {copied ? '✓ Copiado' : '📋 Copiar'}
          </button>

          <button
            onClick={download}
            disabled={!imageUrl || downloading}
            style={{
              ...styles.actionBtn,
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: C.textSecondary,
            }}
          >
            {downloading ? '...' : '💾 Descargar'}
          </button>

          <button
            onClick={shareNative}
            disabled={!imageUrl}
            style={{
              ...styles.actionBtn,
              background: C.positive,
              border: 'none',
              color: '#fff',
              fontWeight: 700,
            }}
          >
            🚀 Compartir
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    width: '100%',
    maxWidth: 560,
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 24px 16px',
    borderBottom: `1px solid ${C.border}`,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: C.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 4,
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: C.textMuted,
    fontSize: 18,
    cursor: 'pointer',
    padding: 4,
  },
  previewArea: {
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'center',
    overflowY: 'auto',
    maxHeight: '60vh',
  },
  cardImage: {
    width: '100%',
    borderRadius: 12,
    border: `1px solid ${C.border}`,
  },
  placeholder: {
    width: '100%',
    aspectRatio: '1200/630',
    background: C.bgCard,
    borderRadius: 12,
    border: `1px solid ${C.border}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  spinner: {
    width: 24,
    height: 24,
    border: `2px solid ${C.border}`,
    borderTopColor: C.positive,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: '16px 24px',
    borderTop: `1px solid ${C.border}`,
    flexWrap: 'wrap',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: 'transparent',
    color: C.textMuted,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    marginRight: 'auto',
  },
  actionBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};
