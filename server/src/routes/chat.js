import express from 'express';
import { z } from 'zod';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { requireAuth } from '../middleware/auth.js';
import { chatSendLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateAssistantReply } from '../services/ai.js';
import {
  startTurn,
  completeTurn,
  rollbackTurn,
  findUserConversation,
  deleteConversation,
  deleteAllConversations
} from '../services/chat.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Every chat route requires an authenticated user
router.use(requireAuth);

const sendMessageSchema = z.object({
  message: z
    .string({ required_error: 'Message is required' })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message is too long (max 4000 characters)'),
  conversationId: z.string().trim().optional()
});

const renameSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(100, 'Title is too long')
});

/**
 * POST /chat/send — send a message and wait for the full AI reply (JSON)
 */
router.post(
  '/send',
  chatSendLimiter,
  asyncHandler(async (req, res) => {
    const input = sendMessageSchema.parse(req.body);
    const turn = await startTurn(req.user._id, input);

    let content;
    try {
      content = await generateAssistantReply(turn.context);
    } catch (err) {
      await rollbackTurn(turn);
      throw err;
    }

    const assistantMessage = await completeTurn(turn, content);
    res.status(200).json({
      conversationId: turn.conversation._id,
      conversation: turn.conversation,
      userMessage: turn.userMessage,
      message: assistantMessage
    });
  })
);

/**
 * POST /chat/send/stream — same as /chat/send but streams the reply as
 * Server-Sent Events: `meta` → `token`* → `done` | `error`.
 * If the client disconnects (e.g. "Stop generating"), the upstream AI call is
 * aborted; the user's message and any partial reply are kept, like ChatGPT.
 */
router.post(
  '/send/stream',
  chatSendLimiter,
  asyncHandler(async (req, res) => {
    const input = sendMessageSchema.parse(req.body);
    // Validation / ownership errors happen before streaming starts → normal JSON errors
    const turn = await startTurn(req.user._id, input);

    // Client gave up before we could acknowledge the message: it never saw it, so undo
    if (req.socket.destroyed) {
      await rollbackTurn(turn);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no' // disable proxy buffering (nginx/Render)
    });

    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // Comment frames keep idle proxies from closing the connection while the model thinks
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 15_000);

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableFinished) controller.abort();
    });

    send('meta', { conversation: turn.conversation, userMessage: turn.userMessage });

    let streamed = '';
    try {
      const content = await generateAssistantReply(turn.context, {
        signal: controller.signal,
        onToken: (token) => {
          streamed += token;
          send('token', { content: token });
        }
      });
      const assistantMessage = await completeTurn(turn, content);
      send('done', { conversation: turn.conversation, message: assistantMessage });
    } catch (err) {
      if (controller.signal.aborted) {
        // User stopped generation: keep the partial answer (the user message is already saved)
        if (streamed.trim()) await completeTurn(turn, streamed.trim());
        return;
      }

      await rollbackTurn(turn);
      if (err.name !== 'AIServiceError') logger.error(err.message, { stack: err.stack });
      send('error', {
        status: err.statusCode || 500,
        error: err.name === 'AIServiceError' ? err.message : 'Something went wrong. Please try again.'
      });
    } finally {
      clearInterval(keepAlive);
      res.end();
    }
  })
);

/**
 * GET /chat/history — the user's conversations, most recently active first
 */
router.get(
  '/history',
  asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .select('-__v')
      .lean();
    res.status(200).json({ conversations });
  })
);

/**
 * GET /chat/history/:conversationId — all messages in one conversation
 */
router.get(
  '/history/:conversationId',
  asyncHandler(async (req, res) => {
    const conversation = await findUserConversation(req.user._id, req.params.conversationId);
    const messages = await Message.find({ conversation: conversation._id, user: req.user._id })
      .sort({ createdAt: 1, _id: 1 })
      .select('-__v')
      .lean();
    res.status(200).json({ conversation, messages });
  })
);

/**
 * PATCH /chat/history/:conversationId — rename a conversation
 */
router.patch(
  '/history/:conversationId',
  asyncHandler(async (req, res) => {
    const { title } = renameSchema.parse(req.body);
    const conversation = await findUserConversation(req.user._id, req.params.conversationId);
    conversation.title = title;
    await conversation.save({ timestamps: false }); // renaming shouldn't reorder the list
    res.status(200).json({ conversation });
  })
);

/**
 * DELETE /chat/history/:conversationId — delete one conversation and its messages
 */
router.delete(
  '/history/:conversationId',
  asyncHandler(async (req, res) => {
    await deleteConversation(req.user._id, req.params.conversationId);
    res.status(204).end();
  })
);

/**
 * DELETE /chat/history — clear all of the user's chat history
 */
router.delete(
  '/history',
  asyncHandler(async (req, res) => {
    const deletedCount = await deleteAllConversations(req.user._id);
    res.status(200).json({ deletedCount });
  })
);

export default router;
