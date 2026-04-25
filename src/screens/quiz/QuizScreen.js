import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../services/firebase';
import { fetchQuiz, submitQuiz, requestHint } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { webScrollStyle, scrollContentStyle, webRootStyle } from '../../constants/webStyles';

const MAX_HINTS = 7;
const QUESTIONS_PER_QUIZ = 10;

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function QuizScreen({ route, navigation }) {
  const { topicId, topicTitle, courseId, difficulty, sessionType } = route.params;
  const { theme, isDark } = useTheme();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [hints, setHints] = useState({});
  const [hintsExpanded, setHintsExpanded] = useState({});
  const [hintsUsed, setHintsUsed] = useState(0);
  const [loadingHint, setLoadingHint] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [error, setError] = useState(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    loadQuiz();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive]);

  const loadQuiz = async () => {
    try {
      setLoading(true);
      setError(null);
      const userId = auth.currentUser?.uid;
      const data = await fetchQuiz(userId, topicId, difficulty, sessionType);
      setSessionId(data.session_id);
      setQuestions(data.questions);
      setTimerActive(true);
    } catch (e) {
      setError('Failed to load quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleHint = async (questionId, questionText) => {
    if (hintsUsed >= MAX_HINTS) return;
    if (hints[questionId]) {
      setHintsExpanded(prev => ({ ...prev, [questionId]: !prev[questionId] }));
      return;
    }
    setLoadingHint(prev => ({ ...prev, [questionId]: true }));
    try {
      const result = await requestHint(questionText, topicTitle, difficulty);
      setHints(prev => ({ ...prev, [questionId]: result.hint }));
      setHintsExpanded(prev => ({ ...prev, [questionId]: true }));
      setHintsUsed(prev => prev + 1);
    } catch (e) {
      Alert.alert('Error', 'Could not load hint. Please try again.');
    } finally {
      setLoadingHint(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter(
      q => !answers[q.question_id] || answers[q.question_id].trim() === ''
    );
    if (unanswered.length > 0) {
      Alert.alert(
        'Incomplete Quiz',
        `You have ${unanswered.length} unanswered question(s). Please answer all questions before submitting.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Submit Quiz',
      'Are you sure you want to submit? You cannot change your answers after submission.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setTimerActive(false);
            setSubmitting(true);
            try {
              const userId = auth.currentUser?.uid;
              const answersArray = questions.map(q => ({
                question_id: q.question_id,
                question_type: q.question_type,
                student_answer: answers[q.question_id] || '',
              }));
              const result = await submitQuiz(
                sessionId, userId, topicId, difficulty,
                answersArray, elapsedSeconds
              );
              navigation.navigate('QuizResultScreen', {
                result,
                topicId,
                topicTitle,
                courseId,
                difficulty,
              });
            } catch (e) {
              Alert.alert('Error', 'Failed to submit quiz. Please try again.');
              setTimerActive(true);
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    Alert.alert(
      'Exit Quiz',
      'Are you sure you want to exit? Your progress will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
  };

  const answeredCount = Object.keys(answers).filter(
    k => answers[k] && answers[k].trim() !== ''
  ).length;

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={[styles.loadingText, { color: theme.text }]}>Loading your quiz...</Text>
        <Text style={[styles.loadingSubText, { color: theme.textSecondary }]}>
          Preparing {QUESTIONS_PER_QUIZ} questions
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.danger} />
        <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadQuiz}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const difficultyLabel = difficulty === 'easy' ? 'First Level' : 'Second Level';

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }, webRootStyle]}>
      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
          {topicTitle}
        </Text>
        <View style={styles.timerContainer}>
          <Text style={[styles.timerText, { color: Colors.primary }]}>
            ⏱ {formatTime(elapsedSeconds)}
          </Text>
        </View>
      </View>

      {/* Hints Banner */}
      <View style={styles.hintsBanner}>
        <Text style={styles.hintsBannerText}>
          💡 You have {MAX_HINTS - hintsUsed} of {MAX_HINTS} hints remaining. Use them wisely.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={[
          { flex: 1 },
          Platform.OS === 'web' && {
            height: 0,
            minHeight: '100%',
          }
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={webScrollStyle}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardVisible ? 160 : 120 },
            scrollContentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quiz Info Row */}
          <View style={styles.quizInfoRow}>
            <Text style={[styles.quizInfoText, { color: theme.textSecondary }]}>
              {questions.length} Questions
            </Text>
            <Text style={[styles.quizInfoText, { color: theme.textSecondary }]}>
              {difficultyLabel}
            </Text>
          </View>

          {/* Questions */}
          {questions.map((question, index) => {
            const qId = question.question_id;
            const isMultipleChoice = question.question_type === 'multiple_choice';
            const hintFetched = !!hints[qId];
            const hintShown = hintsExpanded[qId];
            const isLoadingThisHint = loadingHint[qId];
            const canUseHint = hintsUsed < MAX_HINTS || hintFetched;

            return (
              <View
                key={qId}
                style={[
                  styles.questionCard,
                  {
                    backgroundColor: theme.surface,
                    shadowColor: isDark ? '#000' : '#B0BEC5',
                  },
                ]}
              >
                <View style={styles.questionHeader}>
                  <View style={styles.qNumBadge}>
                    <Text style={styles.qNumText}>Q{index + 1}</Text>
                  </View>
                  <View style={[styles.typePill, { borderColor: theme.border }]}>
                    <Text style={[styles.typePillText, { color: theme.textSecondary }]}>
                      {isMultipleChoice ? 'Multiple Choice' : 'Written Answer'}
                    </Text>
                  </View>
                  {isLoadingThisHint ? (
                    <ActivityIndicator size="small" color={Colors.accent} style={styles.hintLoader} />
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.hintPill,
                        hintFetched
                          ? { backgroundColor: '#FFF3CD', borderColor: Colors.accent }
                          : canUseHint
                          ? { backgroundColor: 'transparent', borderColor: Colors.accent }
                          : { backgroundColor: 'transparent', borderColor: theme.border, opacity: 0.4 },
                      ]}
                      onPress={() => canUseHint && handleHint(qId, question.question_text)}
                      disabled={!canUseHint && !hintFetched}
                    >
                      <Text
                        style={[
                          styles.hintPillText,
                          { color: canUseHint ? Colors.accent : theme.textSecondary },
                        ]}
                      >
                        💡 Hint
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={[styles.questionText, { color: theme.text }]}>
                  {question.question_text}
                </Text>

                {hintShown && hints[qId] && (
                  <View style={styles.hintBox}>
                    <Text style={styles.hintLabel}>💡 Hint:</Text>
                    <Text style={styles.hintContent}>{hints[qId]}</Text>
                  </View>
                )}

                {isMultipleChoice ? (
                  <View style={styles.optionsContainer}>
                    {(question.options || []).map((option, optIdx) => {
                      const isSelected = answers[qId] === option;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <TouchableOpacity
                          key={optIdx}
                          style={[
                            styles.optionButton,
                            isSelected
                              ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                              : { backgroundColor: theme.surface, borderColor: theme.border },
                          ]}
                          onPress={() => setAnswers(prev => ({ ...prev, [qId]: option }))}
                        >
                          <View
                            style={[
                              styles.optionLetterBadge,
                              { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : theme.background },
                            ]}
                          >
                            <Text
                              style={[
                                styles.optionLetter,
                                { color: isSelected ? '#fff' : Colors.primary },
                              ]}
                            >
                              {letter}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.optionText,
                              { color: isSelected ? '#fff' : theme.text },
                            ]}
                          >
                            {option}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.typedContainer}>
                    <Text style={[styles.typedLabel, { color: theme.textSecondary }]}>
                      Your Answer:
                    </Text>
                    <TextInput
                      style={[
                        styles.typedInput,
                        {
                          backgroundColor: theme.surface,
                          borderColor: answers[qId] ? Colors.primary : theme.border,
                          color: theme.text,
                        },
                      ]}
                      multiline
                      placeholder="Type your answer here..."
                      placeholderTextColor={theme.textSecondary}
                      value={answers[qId] || ''}
                      onChangeText={text => setAnswers(prev => ({ ...prev, [qId]: text }))}
                      textAlignVertical="top"
                    />
                  </View>
                )}
              </View>
            );
          })}

          {/* Submit Section */}
          <View style={styles.submitSection}>
            <Text style={[styles.progressText, { color: theme.textSecondary }]}>
              You have answered{' '}
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{answeredCount}</Text>
              {' '}of{' '}
              <Text style={{ color: Colors.primary, fontWeight: '700' }}>{questions.length}</Text>
              {' '}questions
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: questions.length > 0
                      ? `${(answeredCount / questions.length) * 100}%`
                      : '0%',
                  },
                ]}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: submitting ? Colors.primaryDark : Colors.primary },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Quiz →</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 6,
    fontSize: 13,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
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
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  timerContainer: {
    width: 72,
    alignItems: 'flex-end',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
  },
  hintsBanner: {
    backgroundColor: '#FFF8E8',
    borderBottomWidth: 1,
    borderBottomColor: '#F0C060',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hintsBannerText: {
    fontSize: 13,
    color: Colors.accent,
    textAlign: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  quizInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quizInfoText: {
    fontSize: 12,
  },
  questionCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
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
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qNumText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  typePill: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 11,
  },
  hintPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  hintPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hintLoader: {
    marginRight: 4,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    fontWeight: '500',
  },
  hintBox: {
    backgroundColor: '#FFFBF0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  hintLabel: {
    color: Colors.accent,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  hintContent: {
    color: '#444',
    fontSize: 13,
    lineHeight: 20,
  },
  optionsContainer: {
    marginTop: 14,
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  optionLetterBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  optionLetter: {
    fontSize: 13,
    fontWeight: '700',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  typedContainer: {
    marginTop: 14,
  },
  typedLabel: {
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  typedInput: {
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    minHeight: 100,
    maxHeight: 200,
    fontSize: 14,
    lineHeight: 20,
  },
  submitSection: {
    paddingTop: 8,
    paddingBottom: 80,
  },
  progressText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  submitButton: {
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
