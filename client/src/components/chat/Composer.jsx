import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { toast } from 'sonner';
import { ArrowUp, Mic, MicOff, Square } from 'lucide-react';

const MAX_LENGTH = 4000;
const MAX_HEIGHT = 200;

const joinText = (base, addition) => [base.trimEnd(), addition.trim()].filter(Boolean).join(' ');

/**
 * Message input: auto-growing textarea, Enter to send (Shift+Enter for a new line),
 * voice dictation via the Web Speech API, and a Stop button while a reply streams.
 */
export const Composer = forwardRef(({ value, onChange, onSubmit, onStop, isStreaming, disabled }, ref) => {
  const textareaRef = useRef(null);
  const dictationBaseRef = useRef(''); // text that was in the box when dictation started

  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }));

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition, isMicrophoneAvailable } =
    useSpeechRecognition();

  // Live dictation: append what's being said to what was already typed
  useEffect(() => {
    if (listening) onChange(joinText(dictationBaseRef.current, transcript));
  }, [transcript, listening]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isMicrophoneAvailable) toast.error('Microphone access was blocked. Allow it in your browser settings to use voice input.');
  }, [isMicrophoneAvailable]);

  // Auto-resize the textarea to fit its content
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  const stopDictation = () => {
    if (listening) SpeechRecognition.stopListening();
    resetTranscript();
  };

  const toggleDictation = () => {
    if (listening) {
      stopDictation();
      textareaRef.current?.focus();
      return;
    }
    dictationBaseRef.current = value;
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true, language: navigator.language || 'en-US' });
  };

  const tooLong = value.length > MAX_LENGTH;
  const canSend = value.trim().length > 0 && !tooLong && !isStreaming && !disabled;

  const submit = (e) => {
    e?.preventDefault();
    if (!canSend) return;
    stopDictation();
    onSubmit(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape' && isStreaming) onStop();
  };

  return (
    <div className="composer-wrap">
      <form className={`composer ${listening ? 'listening' : ''}`} onSubmit={submit}>
        <label htmlFor="composer-input" className="sr-only">
          Message
        </label>
        <textarea
          id="composer-input"
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={listening ? 'Listening… speak now' : 'Ask Lumi anything…'}
          disabled={disabled}
          autoFocus
        />

        <div className="composer-actions">
          {browserSupportsSpeechRecognition && (
            <button
              type="button"
              className={`icon-btn btn-mic ${listening ? 'active' : ''}`}
              onClick={toggleDictation}
              disabled={disabled || isStreaming}
              aria-pressed={listening}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              data-tooltip={listening ? 'Stop dictation' : 'Voice input'}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {isStreaming ? (
              <motion.button
                key="stop"
                type="button"
                className="icon-btn btn-stop"
                onClick={onStop}
                aria-label="Stop generating"
                data-tooltip="Stop (Esc)"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
              >
                <Square size={14} fill="currentColor" />
              </motion.button>
            ) : (
              <motion.button
                key="send"
                type="submit"
                className="icon-btn btn-send"
                disabled={!canSend}
                aria-label="Send message"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                whileTap={{ scale: 0.9 }}
              >
                <ArrowUp size={19} strokeWidth={2.4} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>

      <div className="composer-footer">
        {listening ? (
          <span className="listening-label">
            <Mic size={12} /> Listening — click the mic again to stop
          </span>
        ) : (
          <span className="disclaimer">Lumi can make mistakes. For account-specific issues, ask to talk to a human.</span>
        )}
        {value.length > MAX_LENGTH * 0.8 && (
          <span className={`char-count ${tooLong ? 'over' : ''}`}>
            {value.length}/{MAX_LENGTH}
          </span>
        )}
      </div>
    </div>
  );
});

Composer.displayName = 'Composer';
