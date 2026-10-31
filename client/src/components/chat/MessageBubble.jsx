import { memo, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { formatTime } from '../../utils/format';
import { TypingIndicator } from './TypingIndicator';

// Links in AI output open in a new tab; raw HTML is never rendered (react-markdown default)
const markdownComponents = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — nothing useful to do
    }
  };

  return (
    <button type="button" className="icon-btn" onClick={copy} aria-label={copied ? 'Copied' : 'Copy message'} data-tooltip={copied ? 'Copied!' : 'Copy'}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

const MessageBubbleInner = ({ message, onRetry }) => {
  const { role, content, streaming, failed, error, stopped, createdAt } = message;
  const isAssistant = role === 'assistant';
  const isThinking = streaming && !content;

  return (
    <motion.div
      className={`msg ${role} ${failed ? 'failed' : ''}`}
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      {isAssistant && (
        <span className="logo-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.8L20 10l-5 3.9L16.5 20 12 16.7 7.5 20 9 13.9 4 10l6.1-1.2z" />
          </svg>
        </span>
      )}

      <div className="msg-body">
        <div className={`bubble ${streaming && content ? 'streaming' : ''}`} aria-live={streaming ? 'polite' : undefined}>
          {isThinking ? (
            <TypingIndicator />
          ) : isAssistant ? (
            <div className="markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            content
          )}
        </div>

        {failed ? (
          <div className="msg-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => onRetry(message._id)}>
              <RotateCcw size={13} /> Retry
            </button>
          </div>
        ) : (
          !streaming && (
            <div className="msg-meta">
              <span>
                {formatTime(createdAt)}
                {stopped && ' · stopped'}
              </span>
              {isAssistant && <CopyButton text={content} />}
            </div>
          )
        )}
      </div>
    </motion.div>
  );
};

export const MessageBubble = memo(MessageBubbleInner);
