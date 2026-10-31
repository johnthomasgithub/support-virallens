import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';

/**
 * Accessible confirmation modal: focuses Cancel, closes on Escape or backdrop click.
 */
export const ConfirmDialog = ({ open, title, description, confirmLabel = 'Delete', busy, onConfirm, onCancel }) => {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-desc"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <div className="modal-icon">
              <Trash2 size={20} />
            </div>
            <h2 id="confirm-title">{title}</h2>
            <p id="confirm-desc">{description}</p>
            <div className="modal-actions">
              <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
                {busy ? <span className="spinner sm" /> : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
