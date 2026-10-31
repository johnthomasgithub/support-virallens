import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Search, Trash, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { groupByRecency, initials } from '../../utils/format';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { ConversationItem } from './ConversationItem';

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const Sidebar = ({
  conversations,
  isLoading,
  activeId,
  isOpen,
  onClose,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  onRename,
  onRequestDelete,
  onRequestClearAll
}) => {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');

  // Mobile drawer: close on Escape, and when the window grows to desktop width
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const desktop = window.matchMedia('(min-width: 861px)');
    const onResize = (e) => e.matches && onClose();
    window.addEventListener('keydown', onKey);
    desktop.addEventListener('change', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      desktop.removeEventListener('change', onResize);
    };
  }, [isOpen, onClose]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
    return groupByRecency(filtered);
  }, [conversations, query]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="sidebar-backdrop"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <aside className={`sidebar ${isOpen ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Conversations">
        <div className="sidebar-header">
          <Logo size={30} />
          <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close sidebar">
            <X size={18} />
          </button>
          {/* Desktop only: shrink the sidebar to an icon rail for a wider chat */}
          <button
            type="button"
            className="icon-btn sidebar-collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            data-tooltip={`${collapsed ? 'Expand' : 'Collapse'} (${isMac ? '⌘' : 'Ctrl'}+B)`}
            data-tooltip-pos={collapsed ? 'right' : 'bottom'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        <div className="sidebar-actions">
          <motion.button
            type="button"
            className="btn btn-primary btn-new-chat"
            onClick={onNewChat}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            aria-label="New chat"
            data-tooltip={collapsed ? 'New chat' : undefined}
            data-tooltip-pos="right"
          >
            <MessageSquarePlus size={18} />
            <span className="btn-label">New chat</span>
            <kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
          </motion.button>

          <label className="search-box">
            <Search size={15} />
            <span className="sr-only">Search conversations</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
            />
          </label>
        </div>

        <nav className="conversations">
          {isLoading ? (
            [0, 1, 2, 3].map((i) => <div key={i} className="conv-skeleton" style={{ opacity: 1 - i * 0.2 }} />)
          ) : groups.length === 0 ? (
            <div className="conv-empty">
              {query ? 'No conversations match your search.' : 'No conversations yet. Start one to see it here.'}
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="conv-group">
                <h2 className="conv-group-title">{group.label}</h2>
                <AnimatePresence initial={false}>
                  {group.items.map((conversation) => (
                    <ConversationItem
                      key={conversation._id}
                      conversation={conversation}
                      active={conversation._id === activeId}
                      onNavigate={onClose}
                      onRename={onRename}
                      onDelete={onRequestDelete}
                    />
                  ))}
                </AnimatePresence>
              </section>
            ))
          )}
        </nav>

        <div className="sidebar-footer">
          {conversations.length > 0 && (
            <button type="button" className="btn btn-ghost btn-clear-all" onClick={onRequestClearAll}>
              <Trash size={16} /> Clear all history
            </button>
          )}
          <div className="user-card">
            <div className="avatar user" aria-hidden="true">
              {initials(user)}
            </div>
            <div className="user-meta">
              <strong>{user?.name || user?.email?.split('@')[0]}</strong>
              <span>{user?.email}</span>
            </div>
            <div className="sidebar-footer-actions">
              <ThemeToggle />
              <button type="button" className="icon-btn danger" onClick={logout} aria-label="Log out" data-tooltip="Log out">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
