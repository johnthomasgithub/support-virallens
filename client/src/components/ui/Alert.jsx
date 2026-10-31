import { motion } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';

export const Alert = ({ message, onDismiss }) => (
  <motion.div
    className="alert"
    role="alert"
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -3, 3, 0] }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.35 }}
  >
    <AlertCircle size={18} />
    <span className="alert-text">{message}</span>
    {onDismiss && (
      <button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    )}
  </motion.div>
);
