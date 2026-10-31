import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, ShieldCheck, Zap } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';

const PREVIEW_SCRIPT = [
  { role: 'user', text: 'Hi! My order hasn’t arrived yet 📦' },
  { role: 'assistant', text: 'Sorry to hear that! Do you have your order number handy? I can walk you through tracking it.' },
  { role: 'user', text: 'Yes — #48213' },
  { role: 'assistant', text: 'Thanks! Here’s how to check its live status…' }
];

/** Plays the preview conversation on a loop, one message at a time. */
const PreviewChat = () => {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const delay = count === PREVIEW_SCRIPT.length ? 3500 : 1600;
    const timer = setTimeout(() => setCount((c) => (c === PREVIEW_SCRIPT.length ? 1 : c + 1)), delay);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <div className="preview-chat" aria-hidden="true">
      <AnimatePresence initial={false}>
        {PREVIEW_SCRIPT.slice(0, count).map((msg) => (
          <motion.div
            key={msg.text}
            className={`preview-msg ${msg.role}`}
            layout
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            {msg.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="auth-page">
    <aside className="auth-showcase">
      <span className="blob blob-1" />
      <span className="blob blob-2" />
      <span className="blob blob-3" />

      <Logo />

      <motion.div
        className="showcase-copy"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <h2>
          Customer support that <em>never sleeps.</em>
        </h2>
        <p>Instant, friendly answers from an AI assistant — with every conversation saved securely to your account.</p>
      </motion.div>

      <PreviewChat />

      <ul className="showcase-features">
        <li>
          <Zap size={16} /> Real-time streaming replies
        </li>
        <li>
          <Mic size={16} /> Voice input
        </li>
        <li>
          <ShieldCheck size={16} /> Private &amp; secure
        </li>
      </ul>
    </aside>

    <main className="auth-panel">
      <div className="auth-panel-top">
        <Logo size={30} />
        <ThemeToggle tooltipPos="bottom" />
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="auth-header">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </header>
        {children}
        <p className="auth-footer">{footer}</p>
      </motion.div>
    </main>
  </div>
);
