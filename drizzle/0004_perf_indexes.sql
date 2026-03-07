-- Performance indexes for hot query paths.
-- conversations: listConversations filters on (userId, deleted) and orders by updatedAt.
-- messages: getMessages filters on conversationId and orders by messageTimestamp.

CREATE INDEX IF NOT EXISTS idx_conversations_userId_deleted_updatedAt
  ON conversations (userId, deleted, updatedAt DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversationId_messageTimestamp
  ON messages (conversationId, messageTimestamp ASC);
