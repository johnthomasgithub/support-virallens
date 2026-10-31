import { forwardRef, memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { getErrorMessage } from '../../api/client';

const ConversationItemInner = forwardRef(({ conversation, active, onNavigate, onRename, onDelete }, ref) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conversation.title);

  const startEditing = () => {
    setTitle(conversation.title);
    setEditing(true);
  };

  const save = async () => {
    const next = title.trim();
    setEditing(false);
    if (!next || next === conversation.title) return;
    try {
      await onRename(conversation._id, next);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not rename the conversation.'));
    }
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24, height: 0, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className={`conv-item ${active ? 'active' : ''}`}
    >
      {editing ? (
        <>
          <input
            className="conv-rename-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') setEditing(false);
            }}
            onBlur={save}
            maxLength={100}
            aria-label="Conversation title"
            autoFocus
          />
          <div className="conv-actions">
            <button type="button" className="icon-btn" onMouseDown={(e) => e.preventDefault()} onClick={save} aria-label="Save title">
              <Check size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setEditing(false)}
              aria-label="Cancel rename"
            >
              <X size={14} />
            </button>
          </div>
        </>
      ) : (
        <>
          <Link
            to={`/chat/${conversation._id}`}
            className="conv-link"
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            title={conversation.title}
          >
            <MessageSquare size={16} />
            <span className="conv-title">{conversation.title}</span>
          </Link>
          <div className="conv-actions">
            <button type="button" className="icon-btn" onClick={startEditing} aria-label={`Rename "${conversation.title}"`}>
              <Pencil size={14} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => onDelete(conversation)}
              aria-label={`Delete "${conversation.title}"`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
});

ConversationItemInner.displayName = 'ConversationItem';

export const ConversationItem = memo(ConversationItemInner);
