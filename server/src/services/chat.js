import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { HttpError } from '../middleware/errorHandler.js';

const CONTEXT_SIZE = 10;

/**
 * Load a conversation only if it belongs to the user.
 * Foreign and malformed ids both return 404 so ids can't be probed.
 */
export const findUserConversation = async (userId, conversationId) => {
  const conversation = mongoose.isValidObjectId(conversationId)
    ? await Conversation.findOne({ _id: conversationId, user: userId })
    : null;
  if (!conversation) throw new HttpError(404, 'Conversation not found.');
  return conversation;
};

/**
 * Persist the user's message (creating the conversation if needed) and
 * build the AI context from the last CONTEXT_SIZE messages.
 */
export const startTurn = async (userId, { message, conversationId }) => {
  const isNew = !conversationId;
  const conversation = isNew
    ? await Conversation.create({ user: userId, title: Conversation.titleFrom(message) })
    : await findUserConversation(userId, conversationId);

  const userMessage = await Message.create({
    conversation: conversation._id,
    user: userId,
    role: 'user',
    content: message
  });

  const recent = await Message.find({ conversation: conversation._id, user: userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(CONTEXT_SIZE)
    .select('role content')
    .lean();

  return { userId, conversation, isNew, userMessage, context: recent.reverse() };
};

/**
 * Save the assistant reply and bump the conversation to the top of the list.
 */
export const completeTurn = async (turn, content) => {
  const assistantMessage = await Message.create({
    conversation: turn.conversation._id,
    user: turn.userId,
    role: 'assistant',
    content
  });

  turn.conversation.updatedAt = new Date();
  await turn.conversation.save();

  return assistantMessage;
};

/**
 * Undo a turn whose AI reply failed, so the history never contains
 * unanswered messages or empty conversations the client doesn't know about.
 */
export const rollbackTurn = async (turn) => {
  if (turn.isNew) {
    await Promise.all([
      Message.deleteMany({ conversation: turn.conversation._id, user: turn.userId }),
      Conversation.deleteOne({ _id: turn.conversation._id, user: turn.userId })
    ]);
  } else {
    await Message.deleteOne({ _id: turn.userMessage._id, user: turn.userId });
  }
};

export const deleteConversation = async (userId, conversationId) => {
  const conversation = await findUserConversation(userId, conversationId);
  await Promise.all([
    Message.deleteMany({ conversation: conversation._id, user: userId }),
    conversation.deleteOne()
  ]);
};

export const deleteAllConversations = async (userId) => {
  const [{ deletedCount }] = await Promise.all([
    Conversation.deleteMany({ user: userId }),
    Message.deleteMany({ user: userId })
  ]);
  return deletedCount;
};
