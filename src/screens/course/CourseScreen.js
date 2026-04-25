/**
 * CourseScreen.js
 */

import { useState, useCallback, useEffect } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../../services/firebase';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { getLearningState, completeOnboarding } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { webScrollStyle, scrollContentStyle, webRootStyle } from '../../constants/webStyles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getMasteryBadge(masteryLevel, difficultyUnlocked, isUnlocked) {
  if (difficultyUnlocked === 'completed' || masteryLevel === 'high')
    return { label: 'Mastered', bg: Colors.success, text: '#fff' };
  if (isUnlocked)
    return { label: 'In Progress', bg: Colors.warning, text: '#fff' };
  return { label: 'Locked', bg: Colors.mastery.locked, text: '#fff' };
}

function getStatusIcon(masteryLevel, difficultyUnlocked, isUnlocked) {
  if (masteryLevel === 'high' || difficultyUnlocked === 'completed')
    return { iconName: 'checkmark-circle', iconColor: '#fff', circleBg: '#E8A020' };
  if (isUnlocked)
    return { iconName: 'book', iconColor: '#fff', circleBg: '#157C8E' };
  return { iconName: 'lock-closed', iconColor: '#fff', circleBg: '#9CA3AF' };
}

async function fetchTopicsDirectly(courseId) {
  const topicsRef = collection(db, 'topics');
  const q = query(
    topicsRef,
    where('course_id', '==', courseId),
    orderBy('order_index', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    topic_id:             doc.id,
    topic_title:          doc.data().title,
    mastery_level:        'locked',
    is_unlocked:          doc.data().order_index === 1,
    easy_quiz_best_score: 0,
    hard_quiz_best_score: 0,
    attempts:             0,
    difficulty_unlocked:  'easy',
    order_index:          doc.data().order_index,
  }));
}

// ---------------------------------------------------------------------------
// Sub-component: TopicRow
// ---------------------------------------------------------------------------
function TopicRow({ topic, courseId, navigation, theme }) {
  const topicId    = topic.topic_id    || topic.id;
  const topicTitle = topic.topic_title || topic.title;
  const mastery    = topic.mastery_level        ?? 'locked';
  const difficulty = topic.difficulty_unlocked  ?? 'easy';
  const unlocked   = topic.is_unlocked          ?? (topic.order_index === 1);
  const completed  = difficulty === 'completed';

  const badge = getMasteryBadge(mastery, difficulty, unlocked);
  const { iconName, iconColor, circleBg } = getStatusIcon(mastery, difficulty, unlocked);

  const handleLesson = () => {
    if (!unlocked) return;
    navigation.navigate('TopicScreen', {
      topicId,
      topicTitle,
      courseId,
      difficulty,
    });
  };

  const getQuizDifficulty = (t) => {
    if (t.difficulty_unlocked === 'completed') return 'hard';
    return t.difficulty_unlocked || 'easy';
  };

  const handleQuiz = () => {
    if (!unlocked) return;
    navigation.navigate('QuizScreen', {
      topicId,
      topicTitle,
      courseId,
      difficulty: getQuizDifficulty(topic),
      sessionType: 'seeded',
    });
  };

  return (
    <View
      style={[
        styles.topicRow,
        { backgroundColor: theme.surface, borderColor: theme.border },
        !unlocked && styles.topicRowLocked,
      ]}
    >
      <View style={styles.topicLeft}>
        <View style={[styles.statusCircle, { backgroundColor: circleBg }]}>
          <Ionicons name={iconName} size={15} color={iconColor} />
        </View>
        <View style={styles.topicInfo}>
          <Text
            style={[
              styles.topicTitle,
              { color: unlocked ? theme.text : theme.textSecondary },
              unlocked && styles.topicTitleUnlocked,
            ]}
            numberOfLines={2}
          >
            {topicTitle}
          </Text>
          <View style={[styles.masteryBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.masteryBadgeText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.topicActions}>
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: Colors.primary }, !unlocked && styles.actionBtnDisabled]}
          onPress={handleLesson}
          disabled={!unlocked}
          activeOpacity={0.7}
        >
          <Ionicons name="book-outline" size={18} color={Colors.primary} />
          <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>Lesson</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { borderColor: Colors.accent },
            !unlocked && styles.actionBtnDisabled,
          ]}
          onPress={handleQuiz}
          disabled={!unlocked}
          activeOpacity={0.7}
        >
          <Ionicons
            name={completed ? 'checkmark-circle-outline' : 'school-outline'}
            size={18}
            color={Colors.accent}
          />
          <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>
            {completed ? 'Done' : 'Quiz'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function CourseScreen({ navigation, route }) {
  const { courseId, courseCode, courseTitle } = route.params ?? {};
  const { theme } = useTheme();

  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [generatedTopicIds, setGeneratedTopicIds] = useState(new Set());

  const checkLessonActivity = async (userId) => {
    try {
      const lessonsRef = collection(db, 'user_lessons');
      const q = query(lessonsRef, where('user_id', '==', userId));
      const snapshot = await getDocs(q);
      return new Set(snapshot.docs.map(d => d.data().topic_id));
    } catch (e) {
      return new Set();
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const genIds = await checkLessonActivity(userId);
      setGeneratedTopicIds(genIds);

      let topicsData = [];
      try {
        const result = await getLearningState(userId, courseId);
        topicsData = result.topics || [];
      } catch (e) {
        topicsData = [];
      }

      if (!topicsData || topicsData.length === 0) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        const userData = userDoc.exists() ? userDoc.data() : null;

        const progressQuery = query(
          collection(db, 'student_progress'),
          where('user_id', '==', userId),
          where('course_id', '==', courseId)
        );
        const progressSnap = await getDocs(progressQuery);

        if (progressSnap.empty) {
          try {
            await completeOnboarding(
              userId,
              userData?.faculty || 'Faculty of Science',
              userData?.course_of_study || 'Computer Science',
              userData?.year_of_study || 1,
              [courseId]
            );
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryResult = await getLearningState(userId, courseId);
            topicsData = retryResult.topics || [];
          } catch (onboardingError) {
            console.log('Onboarding retry failed:', onboardingError);
          }
        } else {
          const progressDocs = progressSnap.docs.map(d => ({
            ...d.data(),
            id: d.id,
          }));

          const topicsQuery = query(
            collection(db, 'topics'),
            where('course_id', '==', courseId),
            orderBy('order_index', 'asc')
          );
          const topicsSnap = await getDocs(topicsQuery);

          topicsData = topicsSnap.docs.map(topicDoc => {
            const topicData = topicDoc.data();
            const progress = progressDocs.find(p => p.topic_id === topicDoc.id);
            return {
              topic_id:             topicDoc.id,
              topic_title:          topicData.title,
              mastery_level:        progress?.mastery_level || 'locked',
              is_unlocked:          progress?.is_unlocked || topicData.order_index === 1,
              easy_quiz_best_score: progress?.easy_quiz_best_score || 0,
              hard_quiz_best_score: progress?.hard_quiz_best_score || 0,
              attempts:             progress?.attempts || 0,
              difficulty_unlocked:  progress?.difficulty_unlocked || 'easy',
              order_index:          topicData.order_index,
            };
          });
        }

        if (!topicsData || topicsData.length === 0) {
          topicsData = await fetchTopicsDirectly(courseId);
        }
      }

      setTopics(topicsData);
    } catch (error) {
      console.error('CourseScreen fetch error:', error);
      try {
        const fallback = await fetchTopicsDirectly(courseId);
        setTopics(fallback);
      } catch (e) {
        setTopics([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  useEffect(() => {
    if (refreshKey === 0) return;
    fetchData();
  }, [refreshKey]);

  useEffect(() => {
    fetchData();
  }, [courseId]);

  const calculateTopicProgress = (topic, generatedIds) => {
    const topicId = topic.topic_id || topic.id;
    if (topic.difficulty_unlocked === 'completed' || topic.mastery_level === 'high') return 100;
    if (topic.difficulty_unlocked === 'hard' && (topic.attempts || 0) > 0) return 75;
    if (topic.difficulty_unlocked === 'hard') return 50;
    if ((topic.attempts || 0) > 0 && topic.difficulty_unlocked === 'easy') return 25;
    if (generatedIds && generatedIds.has(topicId)) return 10;
    if (topic.is_unlocked) return 5;
    return 0;
  };

  const masteredCount = topics.filter(t =>
    t.mastery_level === 'high' || t.difficulty_unlocked === 'completed'
  ).length;
  const progressPercent = topics.length > 0
    ? Math.round(
        topics.reduce((sum, t) => sum + calculateTopicProgress(t, generatedTopicIds), 0) / topics.length
      )
    : 0;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }, webRootStyle]}>

      {/* Fixed header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerCourseCode}>{courseCode}</Text>
          <Text style={[styles.headerCourseTitle, { color: theme.text }]} numberOfLines={1}>
            {courseTitle}
          </Text>
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* Scrollable content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={webScrollStyle}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 140 },
            scrollContentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Overview card */}
          <View style={styles.overviewCard}>
            <View style={styles.overviewTopRow}>
              <Text style={styles.overviewTitle}>{courseTitle}</Text>
              <View style={styles.overviewCodeBadge}>
                <Text style={styles.overviewCodeText}>{courseCode}</Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <View style={[styles.progressTrack, { backgroundColor: '#C5DFE4' }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercent}%`, backgroundColor: Colors.primary },
                  ]}
                />
              </View>
              <Text style={styles.progressPct}>{progressPercent}%</Text>
            </View>

            <Text style={styles.overviewSubtext}>
              {masteredCount} of {topics.length} topic{topics.length !== 1 ? 's' : ''} completed
            </Text>
          </View>

          {/* Topics section */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Topics</Text>

          {topics.length === 0 ? (
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No topics found for this course.
              </Text>
            </View>
          ) : (
            topics.map(topic => (
              <TopicRow
                key={topic.topic_id || topic.id}
                topic={topic}
                courseId={courseId}
                navigation={navigation}
                theme={theme}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* Floating Chat Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Chat', { topicContext: courseTitle || null })}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 40 : (Platform.OS === 'ios' ? 50 : 20),
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerCourseCode: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerCourseTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: '#E8F4F6',
    borderRadius: 14,
    padding: 20,
    marginBottom: 24,
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 10,
  },
  overviewTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.primaryDark,
    lineHeight: 22,
  },
  overviewCodeBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  overviewCodeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPct: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    minWidth: 36,
    textAlign: 'right',
  },
  overviewSubtext: {
    fontSize: 13,
    color: Colors.primaryDark,
    opacity: 0.75,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  topicRowLocked: {
    opacity: 0.6,
  },
  topicLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  statusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  topicInfo: {
    flex: 1,
  },
  topicTitle: {
    fontSize: 14,
    lineHeight: 19,
    color: '#9CA3AF',
  },
  topicTitleUnlocked: {
    fontWeight: '600',
  },
  masteryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginTop: 4,
  },
  masteryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  topicActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.2,
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'web' ? 36 : 24,
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
