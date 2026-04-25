import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { webScrollStyle, scrollContentStyle, webRootStyle } from '../../constants/webStyles';

export default function QuizResultScreen({ route, navigation }) {
  const { result, topicId, topicTitle, courseId, difficulty } = route.params;
  const { theme, isDark } = useTheme();

  const [expandedQuestions, setExpandedQuestions] = useState({});

  const {
    score,
    passed,
    total_questions,
    correct_count,
    next_action,
    message,
    results = [],
  } = result;

  const weakSubtopics = [
    ...new Set(
      results
        .filter(r => !r.is_correct && r.subtopic)
        .map(r => r.subtopic)
    )
  ];

  const toggleQuestionExpand = (id) => {
    setExpandedQuestions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const goHome = () => {
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  const goToCourse = () => {
    navigation.navigate('CourseScreen', { courseId, courseCode: '', courseTitle: '' });
  };

  const goToTopic = (remedial = false) => {
    navigation.navigate('TopicScreen', {
      topicId,
      topicTitle,
      courseId,
      difficulty,
      ...(remedial ? {
        remedial: true,
        weakSubtopics: weakSubtopics.length > 0 ? weakSubtopics : [topicTitle],
      } : {}),
    });
  };

  const goToHardQuiz = () => {
    navigation.navigate('QuizScreen', {
      topicId,
      topicTitle,
      courseId,
      difficulty: 'hard',
      sessionType: 'seeded',
    });
  };

  const nextActionConfig = {
    INCREASE_DIFFICULTY: {
      icon: '🎯',
      heading: 'Level 2 Unlocked!',
      color: Colors.accent,
      bgColor: '#FFFBF0',
    },
    UNLOCK_NEXT_TOPIC: {
      icon: '🏆',
      heading: 'Next Topic Unlocked!',
      color: Colors.success,
      bgColor: '#F0FFF4',
    },
    REPEAT_CONCEPT: {
      icon: '📚',
      heading: 'Keep Practising',
      color: Colors.danger,
      bgColor: '#FFF5F5',
    },
  };

  const actionConfig = nextActionConfig[next_action] || nextActionConfig.REPEAT_CONCEPT;
  const scoreColor = passed ? Colors.success : Colors.danger;
  const scoreCardBg = passed ? '#F0FFF4' : '#FFF0F0';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }, webRootStyle]}>
      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerSpacer} />
        <Text style={[styles.headerTitle, { color: theme.text }]}>Quiz Results</Text>
        <TouchableOpacity style={styles.homeBtn} onPress={goHome}>
          <Ionicons name="home-outline" size={22} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={webScrollStyle}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }, scrollContentStyle]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: scoreCardBg }]}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreNumber, { color: scoreColor }]}>{Math.round(score)}%</Text>
          </View>
          <Text style={[styles.passedLabel, { color: scoreColor }]}>
            {passed ? 'PASSED' : 'FAILED'}
          </Text>
          <Text style={[styles.correctCount, { color: theme.textSecondary }]}>
            {correct_count} of {total_questions} correct
          </Text>
        </View>

        {/* Next Action Card */}
        <View style={[styles.nextActionCard, { backgroundColor: actionConfig.bgColor, borderColor: actionConfig.color }]}>
          <Text style={styles.nextActionIcon}>{actionConfig.icon}</Text>
          <Text style={[styles.nextActionHeading, { color: actionConfig.color }]}>
            {actionConfig.heading}
          </Text>
          <Text style={[styles.nextActionMessage, { color: theme.textSecondary }]}>
            {message}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {next_action === 'INCREASE_DIFFICULTY' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={goToHardQuiz}>
                <Text style={styles.primaryButtonText}>Take Second Level Quiz →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: Colors.primary }]}
                onPress={() => goToTopic(false)}
              >
                <Text style={[styles.secondaryButtonText, { color: Colors.primary }]}>
                  Review Lesson
                </Text>
              </TouchableOpacity>
            </>
          )}

          {next_action === 'UNLOCK_NEXT_TOPIC' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={goToCourse}>
                <Text style={styles.primaryButtonText}>Next Topic →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: Colors.primary }]}
                onPress={goToCourse}
              >
                <Text style={[styles.secondaryButtonText, { color: Colors.primary }]}>
                  Back to Course
                </Text>
              </TouchableOpacity>
            </>
          )}

          {next_action === 'REPEAT_CONCEPT' && (
            <>
              <TouchableOpacity style={styles.primaryButton} onPress={() => goToTopic(true)}>
                <Text style={styles.primaryButtonText}>Study Personalised Lesson →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: Colors.primary }]}
                onPress={goToCourse}
              >
                <Text style={[styles.secondaryButtonText, { color: Colors.primary }]}>
                  Back to Course
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Question Breakdown */}
        <View style={styles.breakdownSection}>
          <View style={styles.breakdownHeader}>
            <Text style={[styles.breakdownTitle, { color: theme.text }]}>Question Breakdown</Text>
            <View style={[styles.countBadge, { backgroundColor: theme.border }]}>
              <Text style={[styles.countBadgeText, { color: theme.textSecondary }]}>
                {results.length}
              </Text>
            </View>
          </View>

          {results.map((item, index) => {
            const isCorrect = item.is_correct;
            const isExpanded = expandedQuestions[item.question_id];
            const borderColor = isCorrect ? Colors.success : Colors.danger;
            const cardBg = isCorrect ? '#F9FFF9' : '#FFF9F9';
            const isTyped = item.question_type === 'typed';

            return (
              <View
                key={item.question_id}
                style={[
                  styles.questionResultCard,
                  {
                    backgroundColor: isDark ? theme.surface : cardBg,
                    borderLeftColor: borderColor,
                  },
                ]}
              >
                <View style={styles.qResultTopRow}>
                  <View style={styles.qResultLeftBadges}>
                    <View style={styles.qNumBadge}>
                      <Text style={styles.qNumText}>Q{index + 1}</Text>
                    </View>
                    <View style={[styles.typePill, { borderColor: theme.border }]}>
                      <Text style={[styles.typePillText, { color: theme.textSecondary }]}>
                        {isTyped ? 'Written' : 'MCQ'}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={borderColor}
                  />
                </View>

                <TouchableOpacity onPress={() => toggleQuestionExpand(item.question_id)}>
                  <Text
                    style={[styles.qResultText, { color: theme.text }]}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {item.question_text}
                  </Text>
                  {!isExpanded && (
                    <Text style={[styles.showMore, { color: Colors.primary }]}>Show more</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.answerRow}>
                  <Text style={[styles.answerLabel, { color: theme.textSecondary }]}>
                    Your Answer:{' '}
                  </Text>
                  <Text style={[styles.answerValue, { color: isCorrect ? Colors.success : Colors.danger }]}>
                    {item.student_answer || '(no answer)'}
                  </Text>
                </View>

                <View style={styles.answerRow}>
                  <Text style={[styles.answerLabel, { color: theme.textSecondary }]}>
                    Correct Answer:{' '}
                  </Text>
                  <Text style={[styles.answerValue, { color: Colors.success }]}>
                    {item.correct_answer}
                  </Text>
                </View>

                {isTyped && item.ai_reasoning ? (
                  <Text style={[styles.aiReasoning, { color: theme.textSecondary }]}>
                    AI Grading: {item.ai_reasoning}
                  </Text>
                ) : null}

                {item.explanation ? (
                  <View style={styles.explanationContainer}>
                    <Text style={[styles.explanationLabel, { color: theme.textSecondary }]}>
                      Explanation:
                    </Text>
                    <Text style={[styles.explanationText, { color: theme.textSecondary }]}>
                      {item.explanation}
                    </Text>
                  </View>
                ) : null}

                {item.subtopic ? (
                  <View style={[styles.subtopicBadge, { backgroundColor: theme.border }]}>
                    <Text style={[styles.subtopicText, { color: theme.textSecondary }]}>
                      {item.subtopic}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.08)' },
    }),
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  homeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreNumber: {
    fontSize: 32,
    fontWeight: '800',
  },
  passedLabel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  correctCount: {
    fontSize: 14,
  },
  nextActionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  nextActionIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  nextActionHeading: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  nextActionMessage: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsContainer: {
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  breakdownSection: {
    marginBottom: 8,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  breakdownTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionResultCard: {
    borderRadius: 10,
    borderLeftWidth: 3,
    padding: 14,
    marginBottom: 12,
  },
  qResultTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  qResultLeftBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qNumBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  qNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 11,
  },
  qResultText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 4,
  },
  showMore: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  answerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  answerValue: {
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  aiReasoning: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 16,
  },
  explanationContainer: {
    marginTop: 8,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  explanationText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  subtopicBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 8,
  },
  subtopicText: {
    fontSize: 11,
  },
});
