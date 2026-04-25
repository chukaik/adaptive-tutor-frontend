import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../services/firebase';
import { fetchLesson, fetchRemedialLesson } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { webScrollStyle, scrollContentStyle, webRootStyle } from '../../constants/webStyles';

const PRIMARY = '#157C8E';
const ACCENT = '#E8A020';

export default function TopicScreen({ route, navigation }) {
  const { topicId, topicTitle, courseId, difficulty, remedial, weakSubtopics } = route.params;
  const { theme } = useTheme();

  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadLesson = async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = auth.currentUser?.uid;
      let data;

      if (remedial && weakSubtopics?.length > 0) {
        data = await fetchRemedialLesson(userId, topicId, weakSubtopics);
      } else {
        data = await fetchLesson(userId, topicId);
      }

      setLesson(data.lesson);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLesson();
  }, [topicId, remedial]);

  const getQuizDifficulty = () => {
    if (difficulty === 'completed') return 'hard';
    return difficulty || 'easy';
  };

  const getQuizButtonLabel = () => {
    if (difficulty === 'completed') return 'Review Quiz →';
    if (lesson?.is_remedial) return 'Take New Quiz →';
    if (difficulty === 'hard') return 'Take Second Level Quiz →';
    return 'Take First Level Quiz →';
  };

  const getQuizButtonBg = () => {
    if (difficulty === 'completed') return '#10B981';
    if (lesson?.is_remedial) return '#E8A020';
    if (difficulty === 'hard') return PRIMARY;
    return PRIMARY;
  };

  const quizButtonStyle = [styles.quizButton, { backgroundColor: getQuizButtonBg() }];

  if (loading) {
    return (
      <View style={[styles.centeredFull, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Generating your personalised lesson...</Text>
        <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centeredFull, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle" size={52} color="#EF4444" />
        <Text style={[styles.errorTitle, { color: theme.text }]}>Failed to load lesson</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadLesson}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }, webRootStyle]}>

      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerCourseCode}>{courseId}</Text>
          <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
            {topicTitle}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {lesson?.is_remedial && (
            <View style={styles.remedialBadge}>
              <Text style={styles.remedialBadgeText}>Personalised</Text>
            </View>
          )}
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={webScrollStyle}
        contentContainerStyle={[styles.scrollContent, scrollContentStyle]}
        showsVerticalScrollIndicator={false}
      >

        {lesson?.introduction && (
          <View style={styles.introCard}>
            <Text style={styles.introLabel}>INTRODUCTION</Text>
            <Text style={styles.introText}>{lesson.introduction}</Text>
          </View>
        )}

        {lesson?.subtopics?.map((subtopic, index) => (
          <View key={index}>
            <View style={styles.subtopicHeader}>
              <View style={styles.subtopicBorderBar} />
              <Text style={[styles.subtopicTitle, { color: theme.text }]}>
                {subtopic.title}
              </Text>
              <Text style={styles.subtopicBadge}>
                {String(index + 1).padStart(2, '0')}
              </Text>
            </View>

            {subtopic.explanation ? (
              <Text style={[styles.explanationText, { color: theme.text }]}>
                {subtopic.explanation}
              </Text>
            ) : null}

            {subtopic.analogy ? (
              <View style={styles.analogyCard}>
                <View style={styles.analogyHeader}>
                  <Ionicons name="bulb-outline" size={16} color={ACCENT} style={{ marginRight: 6 }} />
                  <Text style={styles.analogyLabel}>REAL-WORLD ANALOGY</Text>
                </View>
                <Text style={styles.analogyText}>{subtopic.analogy}</Text>
              </View>
            ) : null}

            {subtopic.code_examples?.map((example, cIdx) => (
              <View key={cIdx} style={styles.codeExampleWrapper}>
                <Text style={styles.codeExampleMeta}>
                  <Text style={styles.codeExampleMetaLabel}>Code Example  </Text>
                  {example.description}
                </Text>
                <View style={styles.codeBlock}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={styles.codeText}>{example.code}</Text>
                  </ScrollView>
                </View>
                {example.output ? (
                  <View style={styles.outputWrapper}>
                    <Text style={styles.outputLabel}>Output:</Text>
                    <View style={styles.outputBlock}>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <Text style={styles.outputText}>{example.output}</Text>
                      </ScrollView>
                    </View>
                  </View>
                ) : null}
              </View>
            ))}

            {subtopic.common_mistakes?.length > 0 && (
              <View style={styles.mistakesCard}>
                <View style={styles.mistakesHeader}>
                  <Text style={styles.mistakesIcon}>⚠️</Text>
                  <Text style={styles.mistakesTitle}>Common Mistakes</Text>
                </View>
                {subtopic.common_mistakes.map((mistake, mIdx) => (
                  <View key={mIdx} style={styles.bulletRow}>
                    <View style={styles.redDot} />
                    <Text style={styles.bulletText}>{mistake}</Text>
                  </View>
                ))}
              </View>
            )}

            {subtopic.practice_tips?.length > 0 && (
              <View style={styles.tipsCard}>
                <View style={styles.tipsHeader}>
                  <Text style={styles.tipsIcon}>✅</Text>
                  <Text style={styles.tipsTitle}>Practice Tips</Text>
                </View>
                {subtopic.practice_tips.map((tip, tIdx) => (
                  <View key={tIdx} style={styles.bulletRow}>
                    <Text style={styles.checkMark}>✓</Text>
                    <Text style={styles.bulletText}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            {index < lesson.subtopics.length - 1 && (
              <View style={[styles.divider, { borderColor: theme.border }]} />
            )}
          </View>
        ))}

        {lesson?.lesson_summary && (
          <View style={styles.summarySection}>
            <Text style={[styles.summarySectionTitle, { color: theme.text }]}>Lesson Summary</Text>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryText}>{lesson.lesson_summary}</Text>
            </View>
          </View>
        )}

        <View style={styles.quizNoticeCard}>
          <Ionicons name="information-circle" size={20} color={ACCENT} style={{ marginRight: 10, marginTop: 1 }} />
          <Text style={styles.quizNoticeText}>
            {lesson?.is_remedial
              ? 'Take the new quiz based on your weak areas from the previous attempt.'
              : difficulty === 'hard'
              ? 'You are on the second level quiz. Pass this to unlock the next topic.'
              : 'The quiz comes in two levels. You must complete both levels before you can advance to the next topic.'}
          </Text>
        </View>

        <TouchableOpacity
          style={quizButtonStyle}
          onPress={() =>
            navigation.navigate('QuizScreen', {
              topicId,
              topicTitle,
              courseId,
              difficulty: getQuizDifficulty(),
              sessionType: 'seeded',
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.quizButtonText}>{getQuizButtonLabel()}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Chat Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Chat', { topicContext: topicTitle || null })}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centeredFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 6,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: PRIMARY,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerCourseCode: {
    fontSize: 11,
    color: PRIMARY,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    width: 84,
    alignItems: 'flex-end',
  },
  remedialBadge: {
    backgroundColor: '#FFF3CC',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  remedialBadgeText: {
    fontSize: 10,
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 96,
  },
  introCard: {
    backgroundColor: '#E8F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  introLabel: {
    fontSize: 10,
    color: PRIMARY,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  introText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1A3A40',
  },
  subtopicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subtopicBorderBar: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: PRIMARY,
    borderRadius: 2,
    marginRight: 12,
  },
  subtopicTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  subtopicBadge: {
    fontSize: 12,
    color: PRIMARY,
    fontWeight: '700',
    marginLeft: 8,
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  analogyCard: {
    backgroundColor: '#FFF8E8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  analogyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  analogyLabel: {
    fontSize: 10,
    color: ACCENT,
    fontWeight: '700',
    letterSpacing: 1,
  },
  analogyText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#2D2D2D',
  },
  codeExampleWrapper: {
    marginBottom: 16,
  },
  codeExampleMeta: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
    lineHeight: 18,
  },
  codeExampleMetaLabel: {
    fontWeight: '600',
    color: '#4B5563',
  },
  codeBlock: {
    backgroundColor: '#1E1E2E',
    borderRadius: 8,
    padding: 16,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 13,
    color: '#E8E8E8',
    lineHeight: 20,
  },
  outputWrapper: {
    marginTop: 8,
  },
  outputLabel: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    marginBottom: 4,
  },
  outputBlock: {
    backgroundColor: '#0F0F1A',
    borderRadius: 6,
    padding: 10,
  },
  outputText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
    fontSize: 12,
    color: '#10B981',
    lineHeight: 18,
  },
  mistakesCard: {
    backgroundColor: '#FFF0F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  mistakesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  mistakesIcon: {
    fontSize: 15,
    marginRight: 6,
  },
  mistakesTitle: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '700',
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 10,
    marginTop: 7,
    flexShrink: 0,
  },
  tipsCard: {
    backgroundColor: '#F0FFF4',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipsIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  tipsTitle: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
  checkMark: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
    marginRight: 10,
    marginTop: 2,
    flexShrink: 0,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  divider: {
    borderTopWidth: 1,
    marginVertical: 8,
  },
  summarySection: {
    marginBottom: 20,
  },
  summarySectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  summaryCard: {
    backgroundColor: '#F0F4F8',
    borderRadius: 12,
    padding: 16,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#1F2937',
  },
  quizNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E8',
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  quizNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#1F2937',
  },
  quizButton: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 40,
  },
  quizButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8A020',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
