import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Menu, SquarePen, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';
import { useChat } from '../hooks/useChat';
import { useConversations } from '../hooks/useConversations';
import { Sidebar } from '../components/chat/Sidebar';
import { MessageList } from '../components/chat/MessageList';
import { Composer } from '../components/chat/Composer';
import { WelcomeScreen } from '../components/chat/WelcomeScreen';
import { Alert } from '../components/ui/Alert';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

const SIDEBAR_KEY = 'lumi-sidebar';

export const ChatPage = () => {
  const { conversationId = null } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'collapsed';
    } catch {
      return false;
    }
  });
  const [pendingDelete, setPendingDelete] = useState(null); // conversation | 'all' | null
  const [deleting, setDeleting] = useState(false);
  const composerRef = useRef(null);

  const { conversations, isLoading: conversationsLoading, upsert, rename, remove, clearAll } = useConversations();

  const handleConversationSaved = useCallback(
    (conversation, { navigate: shouldNavigate }) => {
      upsert(conversation);
      if (shouldNavigate) navigate(`/chat/${conversation._id}`, { replace: true });
    },
    [upsert, navigate]
  );

  const { messages, isLoading, isStreaming, loadError, send, stop, retry } = useChat({
    conversationId,
    onConversationSaved: handleConversationSaved
  });

  const activeConversation = conversations.find((c) => c._id === conversationId);

  const handleSend = async (text) => {
    setDraft('');
    const result = await send(text);
    if (result?.restoreDraft) setDraft(result.restoreDraft);
  };

  const startNewChat = useCallback(() => {
    setSidebarOpen(false);
    setDraft('');
    navigate('/chat');
    composerRef.current?.focus();
  }, [navigate]);

  const toggleSidebarCollapsed = useCallback(() => setSidebarCollapsed((c) => !c), []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? 'collapsed' : 'expanded');
    } catch {
      // storage unavailable — the preference just won't persist
    }
  }, [sidebarCollapsed]);

  // Ctrl/⌘ + K starts a new chat, Ctrl/⌘ + B collapses the sidebar
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        startNewChat();
      } else if (key === 'b') {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startNewChat, toggleSidebarCollapsed]);

  useEffect(() => {
    document.title = activeConversation ? `${activeConversation.title} · Lumi Support` : 'Lumi Support';
  }, [activeConversation]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      if (pendingDelete === 'all') {
        await clearAll();
        toast.success('Chat history cleared');
        navigate('/chat');
      } else {
        await remove(pendingDelete._id);
        toast.success('Conversation deleted');
        if (pendingDelete._id === conversationId) navigate('/chat');
      }
      setPendingDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const closeDialog = useCallback(() => setPendingDelete(null), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const showWelcome = !conversationId && messages.length === 0;

  return (
    <div className="chat-layout">
      <Sidebar
        conversations={conversations}
        isLoading={conversationsLoading}
        activeId={conversationId}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
        onNewChat={startNewChat}
        onRename={rename}
        onRequestDelete={setPendingDelete}
        onRequestClearAll={() => setPendingDelete('all')}
      />

      <main className="chat-main">
        <header className="chat-header">
          <button type="button" className="icon-btn btn-menu" onClick={() => setSidebarOpen(true)} aria-label="Open conversations">
            <Menu size={20} />
          </button>
          <div className="chat-header-title">
            <h1>{activeConversation?.title || 'New conversation'}</h1>
            <span className={`status-pill ${isStreaming ? 'busy' : ''}`}>
              <span className="status-dot" />
              {isStreaming ? 'Lumi is typing…' : 'Lumi · AI assistant online'}
            </span>
          </div>
          <div className="chat-header-actions">
            {conversationId && (
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => activeConversation && setPendingDelete(activeConversation)}
                aria-label="Delete this conversation"
                data-tooltip="Delete chat"
                data-tooltip-pos="bottom"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={startNewChat}
              aria-label="New chat"
              data-tooltip="New chat"
              data-tooltip-pos="bottom"
            >
              <SquarePen size={18} />
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="messages-loading">
            <div className="spinner" />
          </div>
        ) : showWelcome ? (
          <div className="messages">
            <WelcomeScreen user={user} onPick={handleSend} disabled={isStreaming} />
          </div>
        ) : (
          <MessageList messages={messages} onRetry={retry} conversationKey={conversationId} />
        )}

        <AnimatePresence>
          {loadError && (
            <div className="chat-alert">
              <Alert message={loadError} onDismiss={startNewChat} />
            </div>
          )}
        </AnimatePresence>
        <Composer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSubmit={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={Boolean(loadError)}
        />
      </main>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        busy={deleting}
        title={pendingDelete === 'all' ? 'Clear all chat history?' : 'Delete this conversation?'}
        description={
          pendingDelete === 'all'
            ? 'All of your conversations and messages will be permanently deleted. This cannot be undone.'
            : `"${pendingDelete?.title ?? ''}" and all of its messages will be permanently deleted.`
        }
        confirmLabel={pendingDelete === 'all' ? 'Clear history' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      />
    </div>
  );
};
