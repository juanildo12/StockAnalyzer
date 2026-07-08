'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { colors as C, radius as R, font as F } from '@/src/utils/webTheme';

const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  '¿Qué opinas de AAPL?',
  'Explícame los stats de NVDA',
  '¿MSFT está cara o barata?',
  'Muéstrame la tendencia de TSLA',
  'Resume las noticias de AMZN',
  'Analiza GOOGL',
];

function ThinkingIndicator() {
  return (
    <div style={styles.thinkingContainer}>
      <div style={styles.thinkingDot} />
      <div style={{ ...styles.thinkingDot, animationDelay: '0.2s' }} />
      <div style={{ ...styles.thinkingDot, animationDelay: '0.4s' }} />
    </div>
  );
}

export default function AICoach({
  symbol,
  onAnalyzeSymbol,
}: {
  symbol?: string;
  onAnalyzeSymbol?: (symbol: string) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [currentTicker, setCurrentTicker] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasAutoSent = useRef(false);

  const QUICK_ACTIONS = [
    { label: 'Explain the stats', getMsg: (t: string) => t ? `Explícame los stats de ${t}` : '' },
    { label: 'Summarize news', getMsg: (t: string) => t ? `Resume las noticias de ${t}` : '' },
    { label: 'Show me the trend', getMsg: (t: string) => t ? `Muéstrame la tendencia de ${t}` : '' },
    { label: 'Tell me about this company', getMsg: (t: string) => t ? `Dime sobre la compañía ${t}` : '' },
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (symbol && !hasAutoSent.current) {
      hasAutoSent.current = true;
      const msg = `Analiza ${symbol}`;
      sendMessageFromProp(msg);
    }
  }, [symbol]);

  const sendMessageFromProp = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMessage: Message = { role: 'user', content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setShowSuggestions(false);
    setLoading(true);
    await streamResponse(content, MODEL, updatedMessages);
  };

  const SKIP_WORDS = new Set([
    'NO','ES','EL','LA','LO','LE','SE','ME','TE','UN','UNA','SON','POR',
    'CON','SIN','DEL','QUE','LAS','LOS','LES','MAS','PERO','CADA','SUS',
    'ERA','HAN','SER','ESTA','ESTE','ESE','ESA','ELLA','ELLOS','TAMBIEN',
    'ENTRE','DONDE','THE','AND','FOR','NOT','ARE','BUT','HAS','HAD',
    'ITS','ALL','CAN','HOW','NOW','MAY','BUY','HOLD','SELL','ALTO',
    'BAJO','MUY','TIPO','PARTE','CADA','OTRO','OTRA','VALE','MAS',
    'NEW','TOP','BIG','FAR','GET','WAY','YEAR','LONG','SHORT','WEEK',
    'DAY','MONTH','ALSO','WILL','THAN','THAT','THIS','FROM','WITH',
    'AA','AAA','BBB','CCC','A','B','C','D','F','BB','DD','FF'
  ]);

  const detectSymbol = (text: string): string | null => {
    const words = text.match(/\b[A-Z]{2,6}\b/g);
    if (!words) return null;
    for (const w of words) {
      if (!SKIP_WORDS.has(w) && /^[A-Z]{1,5}$/.test(w)) return w;
    }
    return null;
  };

  const streamResponse = async (content: string, model: string, context: Message[]) => {
    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: context.map(m => ({ role: m.role, content: m.content })),
          model,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.error || 'No se pudo obtener respuesta'}` }]);
        setLoading(false);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No se pudo leer la respuesta');
      const assistantMessage: Message = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMessage]);
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: buffer };
          return updated;
        });
      }
      setMessages(prev => {
        const finalContent = prev[prev.length - 1]?.content || buffer;
        const sym = detectSymbol(finalContent);
        if (sym && sym !== symbol) {
          setCurrentTicker(sym);
        }
        return prev;
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error de conexión: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMessage: Message = { role: 'user', content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setShowSuggestions(false);
    setLoading(true);
    await streamResponse(content, MODEL, updatedMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestionClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.aiIcon}>AI</div>
          <div style={{ flex: 1 }}>
            <h2 style={styles.headerTitle}>FinRobot Coach</h2>
            <p style={styles.headerSubtitle}>AI Agent financiero multi-perspectiva — Metodología AI4Finance</p>
          </div>
        </div>
      </div>

      <div style={styles.messagesContainer}>
        {messages.length === 0 && !showSuggestions && (
          <div style={styles.emptyState}>
            <p style={styles.emptyStateText}>Envía un mensaje para comenzar</p>
          </div>
        )}

        {messages.length === 0 && showSuggestions && (
          <div style={styles.welcomeContainer}>
            <div style={styles.welcomeHeader}>
              <span style={styles.welcomeIcon}>🤖</span>
              <h3 style={styles.welcomeTitle}>FinRobot Coach</h3>
              <p style={styles.welcomeText}>
                Análisis multi-agente con metodología FinRobot. Cada análisis pasa por IDENTIFICAR → ANALIZAR → SINTETIZAR → VEREDICTO.
              </p>
            </div>
            <div style={styles.suggestionsGrid}>
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(q)}
                  style={styles.suggestionButton}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.messageRow,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              {msg.role === 'assistant' ? (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    table: ({ children }) => (
                      <div style={styles.tableWrapper}>
                        <table style={styles.table}>{children}</table>
                      </div>
                    ),
                    th: ({ children }) => <th style={styles.th}>{children}</th>,
                    td: ({ children }) => <td style={styles.td}>{children}</td>,
                    strong: ({ children }) => <strong style={styles.strong}>{children}</strong>,
                    h3: ({ children }) => <h3 style={styles.h3}>{children}</h3>,
                    code: ({ children }) => <code style={styles.code}>{children}</code>,
                    p: ({ children }) => <p style={styles.p}>{children}</p>,
                    ul: ({ children }) => <ul style={styles.ul}>{children}</ul>,
                    li: ({ children }) => <li style={styles.li}>{children}</li>,
                  }}>
                    {msg.content || ' '}
                  </ReactMarkdown>
                </div>
              ) : (
                <p style={styles.userText}>{msg.content}</p>
              )}
            </div>
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === 'user' && (
          <div style={styles.messageRow}>
            <div style={styles.assistantBubble}>
              <ThinkingIndicator />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={styles.quickActions}>
        {QUICK_ACTIONS.map((action, i) => {
          const msg = action.getMsg(currentTicker || '');
          return (
            <button
              key={i}
              onClick={() => msg && sendMessage(msg)}
              disabled={loading || !msg}
              style={{
                ...styles.quickActionBtn,
                opacity: loading || !msg ? 0.4 : 1,
                cursor: loading || !msg ? 'not-allowed' : 'pointer',
              }}
            >
              {action.label}
            </button>
          );
        })}
      </div>

      <div style={styles.inputContainer}>
        <div style={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ej: ¿Qué opinas de AAPL?"
            style={styles.input}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              ...styles.sendButton,
              opacity: loading || !input.trim() ? 0.5 : 1,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '...' : '→'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
        .markdown-content table {
          width: 100%;
          border-collapse: collapse;
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 140px)',
    maxWidth: '900px',
    margin: '0 auto',
    background: C.bg,
    borderRadius: '16px',
    border: '1px solid ' + C.border,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid ' + C.border,
    background: C.gradientCard,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  aiIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  headerTitle: {
    margin: 0,
    color: C.textPrimary,
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '-0.3px',
  },
  headerSubtitle: {
    margin: '2px 0 0',
    color: C.textMuted,
    fontSize: '12px',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: C.textMuted,
  },
  emptyStateText: {
    fontSize: '14px',
  },
  welcomeContainer: {
    textAlign: 'center',
    padding: '24px',
    background: 'linear-gradient(180deg, ' + C.bgCard + ' 0%, transparent 100%)',
    borderRadius: '12px',
    border: '1px solid ' + C.border,
  },
  welcomeHeader: {
    marginBottom: '20px',
  },
  welcomeIcon: {
    fontSize: '48px',
    display: 'block',
    marginBottom: '12px',
  },
  welcomeTitle: {
    color: C.textPrimary,
    fontSize: '20px',
    fontWeight: '600',
    margin: '0 0 8px',
  },
  welcomeText: {
    color: C.textMuted,
    fontSize: '14px',
    margin: 0,
    lineHeight: '1.5',
  },
  suggestionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  suggestionButton: {
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid ' + C.border,
    background: C.bgCard,
    color: C.textSecondary,
    cursor: 'pointer',
    fontSize: '14px',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  messageRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
  },
  userBubble: {
    maxWidth: '75%',
    padding: '12px 16px',
    borderRadius: '16px 16px 4px 16px',
    background: C.accent,
    color: 'white',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  assistantBubble: {
    maxWidth: '85%',
    padding: '12px 16px',
    borderRadius: '16px 16px 16px 4px',
    background: C.bgCard,
    color: C.textSecondary,
    fontSize: '14px',
    lineHeight: '1.6',
    border: '1px solid ' + C.border,
  },
  userText: {
    margin: 0,
    color: 'white',
  },
  thinkingContainer: {
    display: 'flex',
    gap: '4px',
    padding: '4px 0',
    alignItems: 'center',
  },
  thinkingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: C.accent,
    animation: 'bounce 1.4s infinite ease-in-out',
  },
  quickActions: {
    display: 'flex',
    gap: '6px',
    padding: '8px 20px 0',
    background: C.bgCard,
    flexWrap: 'wrap',
  },
  quickActionBtn: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid ' + C.border,
    background: C.bg,
    color: C.textMuted,
    cursor: 'pointer',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  inputContainer: {
    padding: '16px 20px',
    borderTop: '1px solid ' + C.border,
    background: C.bgCard,
  },
  inputWrapper: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '10px',
    border: '1px solid ' + C.border,
    background: C.bg,
    color: C.textSecondary,
    fontSize: '14px',
    outline: 'none',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    borderRadius: '10px',
    border: 'none',
    background: C.accent,
    color: 'white',
    fontSize: '18px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableWrapper: {
    overflowX: 'auto',
    margin: '8px 0',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '8px 12px',
    borderBottom: '2px solid ' + C.border,
    color: C.textMuted,
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '12px',
  },
  td: {
    padding: '6px 12px',
    borderBottom: '1px solid ' + C.borderLight,
    color: C.textSecondary,
  },
  strong: {
    color: C.textPrimary,
  },
  h3: {
    color: C.accent,
    fontSize: '15px',
    fontWeight: '600',
    margin: '12px 0 8px',
  },
  code: {
    background: C.bg,
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '12px',
    color: C.textPrimary,
  },
  p: {
    margin: '4px 0',
    color: C.textSecondary,
  },
  ul: {
    margin: '4px 0',
    paddingLeft: '20px',
    color: C.textSecondary,
  },
  li: {
    margin: '2px 0',
  },
};
