import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../services/firebase';
import { sendChatMessage, getChatSessions, createChatSession } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { webFlatListStyle, webRootStyle } from '../../constants/webStyles';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const SUGGESTIONS = [
  'What courses are available?',
  'Help me understand OOP',
  'How does the quiz system work?',
];

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ theme, onSuggestion }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>🤖</Text>
      <Text style={[styles.emptyTitle, { color: Colors.primary }]}>Hey, I'm Chukky!</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Your AI learning companion for AdaptiveTutor.
      </Text>
      <View style={styles.chipsRow}>
        {SUGGESTIONS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, { borderColor: Colors.primary }]}
            onPress={() => onSuggestion(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: Colors.primary }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingBubble({ theme }) {
  return (
    <View style={styles.bubbleRowAssistant}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarEmoji}>🤖</Text>
      </View>
      <View>
        <View
          style={[
            styles.bubble,
            styles.bubbleAssistant,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.typingText, { color: theme.textSecondary }]}>
            Chukky is typing…
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ item, theme }) {
  if (item.isLoading) {
    return <TypingBubble theme={theme} />;
  }

  const isUser = item.role === 'user';

  if (isUser) {
    return (
      <View style={styles.bubbleRowUser}>
        <View style={[styles.bubble, styles.bubbleUser, { backgroundColor: Colors.primary }]}>
          <Text style={styles.bubbleTextUser}>{item.content}</Text>
        </View>
        <Text style={[styles.timestamp, styles.timestampRight]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.bubbleRowAssistant}>
      <View style={styles.avatarContainer}>
        <Text style={styles.avatarEmoji}>🤖</Text>
      </View>
      <View style={{ maxWidth: '95%', flexShrink: 1 }}>
        <View
          style={[
            styles.bubble,
            styles.bubbleAssistant,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.bubbleTextAssistant, { color: theme.text }]}>
            {item.content}
          </Text>
        </View>
        <Text style={[styles.timestamp, styles.timestampLeft]}>
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { height } = useWindowDimensions();
  const userId = auth.currentUser?.uid;
  const topicContext = route.params?.topicContext ?? null;

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  const flatListRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!userId) {
      setInitialLoading(false);
      return;
    }

    const initSessions = async () => {
      try {
        const result = await getChatSessions(userId);
        const existingSessions = result.sessions || [];

        let sessionId;
        if (existingSessions.length > 0) {
          sessionId = existingSessions[0].session_id;
          setSessions(existingSessions);
        } else {
          const created = await createChatSession(userId);
          sessionId = created.session_id;
          setSessions([{ session_id: sessionId, title: 'New Chat', message_count: 0 }]);
        }

        setCurrentSessionId(sessionId);

        const snapshot = await getDocs(
          query(
            collection(db, 'chat_history', userId, 'sessions', sessionId, 'messages'),
            orderBy('timestamp', 'asc')
          )
        );
        const loaded = snapshot.docs.map((doc) => ({
          id: doc.id,
          role: doc.data().role,
          content: doc.data().content,
          timestamp: doc.data().timestamp,
        }));
        setMessages(loaded);
      } catch (err) {
        // No history yet — start fresh
      } finally {
        setInitialLoading(false);
      }
    };

    initSessions();
  }, [userId]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const result = await getChatSessions(userId);
      setSessions(result.sessions || []);
    } catch (e) {
      console.log('Failed to load sessions:', e);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleNewSession = async () => {
    setCreatingSession(true);
    try {
      const result = await createChatSession(userId);
      const newSessionId = result.session_id;
      setCurrentSessionId(newSessionId);
      setMessages([]);
      setSessions(prev => [{
        session_id: newSessionId,
        title: 'New Chat',
        message_count: 0,
      }, ...prev]);
      setShowSessionsModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create new session.');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSwitchSession = async (sessionId) => {
    setShowSessionsModal(false);
    setCurrentSessionId(sessionId);
    setMessages([]);
    setInitialLoading(true);
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'chat_history', userId, 'sessions', sessionId, 'messages'),
          orderBy('timestamp', 'asc')
        )
      );
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        role: doc.data().role,
        content: doc.data().content,
        timestamp: doc.data().timestamp,
      }));
      setMessages(loadedMessages);
    } catch (e) {
      console.log('Failed to switch session:', e);
    } finally {
      setInitialLoading(false);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSending(true);

    try {
      await addDoc(collection(db, 'chat_history', userId, 'messages'), {
        role: 'user',
        content: text,
        timestamp: serverTimestamp(),
      });
    } catch {
      // non-critical
    }

    const loadingMsg = { id: 'loading', role: 'assistant', content: '', isLoading: true };
    setMessages((prev) => [...prev, loadingMsg]);

    const conversationHistory = messages
      .filter((m) => !m.isLoading)
      .map((m) => ({ role: m.role, content: m.content }));
    conversationHistory.push({ role: 'user', content: text });

    try {
      const result = await sendChatMessage(userId, text, topicContext, conversationHistory, currentSessionId);
      const replyContent =
        result?.response ?? result?.message ?? result?.content ?? 'I could not generate a response.';

      if (result?.session_id) setCurrentSessionId(result.session_id);

      const assistantMsg = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date(),
      };
      setMessages((prev) => prev.filter((m) => m.id !== 'loading').concat(assistantMsg));

      try {
        await addDoc(collection(db, 'chat_history', userId, 'messages'), {
          role: 'assistant',
          content: replyContent,
          timestamp: serverTimestamp(),
        });
      } catch {
        // non-critical
      }
    } catch (err) {
      const errorMsg = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't process that. Please check your connection and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => prev.filter((m) => m.id !== 'loading').concat(errorMsg));
    } finally {
      setSending(false);
    }
  };

  const canSend = inputText.trim().length > 0 && !sending;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }, webRootStyle]}>
      {/* Fixed Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: Colors.primary }]}>Chukky</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            AI Companion
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => { loadSessions(); setShowSessionsModal(true); }}
          style={{ padding: 8 }}
        >
          <Ionicons name="time-outline" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* KeyboardAvoidingView wraps messages + input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {initialLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading conversation...
            </Text>
          </View>
        ) : (
          <View style={[
            { flex: 1 },
            Platform.OS === 'web' && {
              height: height - 180,
              maxHeight: height - 180,
            }
          ]}>
            <FlatList
              ref={flatListRef}
              data={messages}
              style={webFlatListStyle}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble item={item} theme={theme} />}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 && styles.listContentEmpty,
              ]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <EmptyState theme={theme} onSuggestion={(s) => setInputText(s)} />
              }
            />
          </View>
        )}

        {/* Input Area */}
        <View
          style={[
            styles.inputBar,
            { backgroundColor: theme.surface, borderTopColor: theme.border },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: theme.background,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask Chukky anything..."
            placeholderTextColor={theme.textSecondary}
            multiline
            maxHeight={100}
            returnKeyType="send"
            onSubmitEditing={() => {
              if (canSend) handleSend();
            }}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: canSend ? Colors.primary : '#9CA3AF' },
            ]}
            onPress={handleSend}
            disabled={!canSend}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Sessions Modal */}
      <Modal
        visible={showSessionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSessionsModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSessionsModal(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalContainer, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Chat Sessions</Text>
            <TouchableOpacity onPress={() => setShowSessionsModal(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.newSessionButton, { backgroundColor: Colors.primary }]}
            onPress={handleNewSession}
            disabled={creatingSession}
          >
            {creatingSession
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <Ionicons name="add-circle-outline" size={20} color="#fff" />
                  <Text style={styles.newSessionText}>Start New Chat</Text>
                </>
            }
          </TouchableOpacity>

          {loadingSessions ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
          ) : sessions.length === 0 ? (
            <Text style={[styles.emptySessionsText, { color: theme.textSecondary }]}>
              No chat sessions yet.
            </Text>
          ) : (
            <FlatList
              data={sessions}
              keyExtractor={item => item.session_id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.sessionItem,
                    {
                      backgroundColor: item.session_id === currentSessionId
                        ? `${Colors.primary}15`
                        : theme.background,
                      borderColor: item.session_id === currentSessionId
                        ? Colors.primary
                        : theme.border,
                    }
                  ]}
                  onPress={() => handleSwitchSession(item.session_id)}
                >
                  <View style={styles.sessionItemLeft}>
                    <Ionicons
                      name="chatbubbles-outline"
                      size={20}
                      color={item.session_id === currentSessionId ? Colors.primary : theme.textSecondary}
                    />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.sessionTitle,
                          { color: item.session_id === currentSessionId ? Colors.primary : theme.text }
                        ]}
                        numberOfLines={1}
                      >
                        {item.title || 'Chat Session'}
                      </Text>
                      <Text style={[styles.sessionMeta, { color: theme.textSecondary }]}>
                        {item.message_count} messages
                      </Text>
                    </View>
                  </View>
                  {item.session_id === currentSessionId && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  keyboardView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  listContentEmpty: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bubbleRowUser: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    maxWidth: '75%',
    marginBottom: 4,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleRowAssistant: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
    maxWidth: '90%',
    marginBottom: 4,
    gap: 6,
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F4F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  avatarEmoji: {
    fontSize: 16,
  },
  bubbleAssistant: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleTextUser: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextAssistant: {
    fontSize: 15,
    lineHeight: 22,
    flexWrap: 'wrap',
  },
  typingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  timestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 3,
  },
  timestampRight: {
    alignSelf: 'flex-end',
  },
  timestampLeft: {
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  newSessionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  newSessionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  emptySessionsText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
});
