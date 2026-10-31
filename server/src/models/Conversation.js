import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    }
  },
  {
    timestamps: true
  }
);

// Supports the sidebar query: a user's conversations, most recently active first
conversationSchema.index({ user: 1, updatedAt: -1 });

conversationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

/**
 * Title from the first ~40 characters of the opening message, cut on a word boundary
 */
conversationSchema.statics.titleFrom = (message) => {
  const singleLine = message.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= 40) return singleLine;
  const cut = singleLine.slice(0, 40);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trim()}…`;
};

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
