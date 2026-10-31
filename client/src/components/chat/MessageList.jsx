import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

const NEAR_BOTTOM_PX = 120;

/**
 * Scrollable message feed. Auto-scrolls while the user is at the bottom
 * (including during streaming) but never yanks them down if they scrolled up to read.
 */
export const MessageList = ({ messages, onRetry, conversationKey }) => {
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowJump(!nearBottom);
  };

  // Opening a conversation: jump straight to the latest message
  useLayoutEffect(() => {
    stickToBottomRef.current = true;
    setShowJump(false);
    scrollToBottom('auto');
  }, [conversationKey, scrollToBottom]);

  // New messages / streamed tokens: follow along only if the user is at the bottom
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom(last?.streaming ? 'auto' : 'smooth');
  }, [messages.length, last?.content, last?.streaming, scrollToBottom]);

  // Sending a message always scrolls down
  useEffect(() => {
    if (last?.role === 'user' || last?.streaming) {
      stickToBottomRef.current = true;
      scrollToBottom();
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="messages-wrap">
      <div className="messages" ref={scrollRef} onScroll={handleScroll}>
        <div className="messages-inner" role="log" aria-label="Conversation">
          {messages.map((message) => (
            <MessageBubble key={message._id} message={message} onRetry={onRetry} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showJump && (
          <motion.button
            type="button"
            className="scroll-bottom"
            onClick={() => scrollToBottom()}
            aria-label="Scroll to latest message"
            initial={{ opacity: 0, y: 10, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 10, x: '-50%' }}
          >
            <ArrowDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
