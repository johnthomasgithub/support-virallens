import { motion } from 'framer-motion';
import { CreditCard, PackageSearch, RotateCcw, UserRound } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { displayName, greeting } from '../../utils/format';

const SUGGESTIONS = [
  { icon: PackageSearch, title: 'Track an order', prompt: 'How can I track the status of my order?' },
  { icon: RotateCcw, title: 'Returns & refunds', prompt: 'What is the usual process for returning an item and getting a refund?' },
  { icon: CreditCard, title: 'Billing question', prompt: 'I was charged twice for the same order. What should I do?' },
  { icon: UserRound, title: 'Talk to a human', prompt: 'Can I speak with a human support agent?' }
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } }
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } }
};

export const WelcomeScreen = ({ user, onPick, disabled }) => (
  <motion.div className="welcome" variants={container} initial="hidden" animate="show">
    <motion.div className="welcome-orb" variants={item}>
      <Logo size={76} showText={false} />
    </motion.div>

    <motion.h2 variants={item}>
      {greeting()}, <span>{displayName(user)}</span>
    </motion.h2>
    <motion.p variants={item}>
      I&apos;m Lumi, your AI support assistant. Ask me anything about orders, billing or your account — or pick a topic to get
      started.
    </motion.p>

    <div className="suggestions">
      {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
        <motion.button
          key={title}
          type="button"
          className="suggestion"
          variants={item}
          whileHover={{ y: -3 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onPick(prompt)}
          disabled={disabled}
        >
          <span className="suggestion-icon">
            <Icon size={18} />
          </span>
          <span>
            <strong>{title}</strong>
            <span>{prompt}</span>
          </span>
        </motion.button>
      ))}
    </div>
  </motion.div>
);
