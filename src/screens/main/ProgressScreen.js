import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { auth, db } from '../../services/firebase';
import { getFullProgress, getLearningState } from '../../services/api';
import { collection, query, where, orderBy, getDocs, limit, getDoc, doc } from 'firebase/firestore';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { COURSE_ID_COS201, COURSE_ID_CSC301 } from '../../constants/courseIds';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// ─── Static Data ────────────────────────────────────────────────────────────

const ALL_COURSES = [
  { id: 'TEbLVrd24pWd27qXnbnC', code: 'COS201', title: 'Computer Programming I' },
  { id: 'QhVX2kifeGLeN9Q1uJA7', code: 'CSC301', title: 'Data Structures' },
];

const ALL_BADGES = [
  { id: 'first_step',        emoji: '🎯', name: 'First Step',        category: 'Learning Milestones',  definition: 'Complete your very first lesson' },
  { id: 'quiz_debut',        emoji: '📝', name: 'Quiz Debut',        category: 'Learning Milestones',  definition: 'Attempt your very first quiz' },
  { id: 'first_win',         emoji: '✅', name: 'First Win',         category: 'Learning Milestones',  definition: 'Pass your very first quiz' },
  { id: 'perfect_score',     emoji: '💯', name: 'Perfect Score',     category: 'Learning Milestones',  definition: 'Score 100% on any quiz' },
  { id: 'speed_learner',     emoji: '⚡', name: 'Speed Learner',     category: 'Learning Milestones',  definition: 'Complete a quiz in under 3 minutes' },
  { id: 'speed_pro',         emoji: '🏎️', name: 'Speed Pro',         category: 'Learning Milestones',  definition: 'Complete 3 quizzes each in under 3 minutes' },
  { id: 'perfect_score_x2',  emoji: '🌠', name: 'Perfect Score X2',  category: 'Learning Milestones',  definition: 'Score 100% on 3 different quizzes' },
  { id: 'topic_explorer',    emoji: '🔓', name: 'Topic Explorer',    category: 'Topic Progress',       definition: 'Unlock your second topic' },
  { id: 'halfway_there',     emoji: '🏃', name: 'Halfway There',     category: 'Topic Progress',       definition: 'Complete 50% of topics in any course' },
  { id: 'topic_master',      emoji: '🏆', name: 'Topic Master',      category: 'Topic Progress',       definition: 'Master a single topic (pass both quiz levels)' },
  { id: 'course_champion',   emoji: '🎓', name: 'Course Champion',   category: 'Topic Progress',       definition: 'Complete all topics in any course' },
  { id: 'streak_starter',    emoji: '🔥', name: 'Streak Starter',    category: 'Streak & Consistency', definition: 'Maintain a 3-day login streak' },
  { id: 'dedicated_learner', emoji: '💪', name: 'Dedicated Learner', category: 'Streak & Consistency', definition: 'Maintain a 7-day login streak' },
  { id: 'unstoppable',       emoji: '🚀', name: 'Unstoppable',       category: 'Streak & Consistency', definition: 'Maintain a 14-day login streak' },
  { id: 'invincible',        emoji: '👑', name: 'Invincible',        category: 'Streak & Consistency', definition: 'Maintain a 30-day login streak' },
  { id: 'never_give_up',     emoji: '💎', name: 'Never Give Up',     category: 'Resilience',           definition: 'Retry a failed quiz and pass it' },
  { id: 'comeback_kid',      emoji: '🌟', name: 'Comeback Kid',      category: 'Resilience',           definition: 'Go from failing to scoring 80%+ on the same topic' },
  { id: 'curious_mind',      emoji: '🤔', name: 'Curious Mind',      category: 'AI Tutor',             definition: 'Ask the AI Tutor your first question' },
  { id: 'hint_seeker',       emoji: '💡', name: 'Hint Seeker',       category: 'AI Tutor',             definition: 'Use a hint for the first time' },
];

// ─── Badge Checking Logic ────────────────────────────────────────────────────

const checkEarnedBadges = (userData, allTopicsData, quizSessions, chatHistory) => {
  const earned = new Set();
  const streak = userData?.login_streak || 0;
  const allTopics = allTopicsData.flat();
  const passedSessions = quizSessions.filter(s => s.passed === true);
  const perfectSessions = quizSessions.filter(s => s.score === 100);
  const speedSessions = quizSessions.filter(s => s.passed && (s.time_taken_seconds || 999) < 180);
  const failedTopics = new Set(quizSessions.filter(s => !s.passed).map(s => s.topic_id));

  if (allTopics.some(t => (t.attempts || 0) > 0 || t.difficulty_unlocked !== 'easy')) earned.add('first_step');
  if (quizSessions.length > 0) earned.add('quiz_debut');
  if (passedSessions.length > 0) earned.add('first_win');
  if (perfectSessions.length >= 1) earned.add('perfect_score');
  if (perfectSessions.length >= 3) earned.add('perfect_score_x2');
  if (speedSessions.length >= 1) earned.add('speed_learner');
  if (speedSessions.length >= 3) earned.add('speed_pro');

  const hardQuizPassed = quizSessions.some(
    s => s.passed === true &&
    (s.difficulty === 'hard' || s.difficulty === 'completed')
  );
  if (hardQuizPassed) earned.add('topic_explorer');

  const cos201Topics = allTopicsData[0] || [];
  const csc301Topics = allTopicsData[1] || [];

  [cos201Topics, csc301Topics].forEach(courseTopics => {
    if (courseTopics.length === 0) return;
    const mastered = courseTopics.filter(
      t => t.mastery_level === 'high' || t.difficulty_unlocked === 'completed'
    ).length;
    if (mastered >= Math.ceil(courseTopics.length / 2)) earned.add('halfway_there');
  });

  if (allTopics.some(t => t.mastery_level === 'high' || t.difficulty_unlocked === 'completed')) {
    earned.add('topic_master');
  }

  [cos201Topics, csc301Topics].forEach(courseTopics => {
    if (courseTopics.length === 0) return;
    if (courseTopics.every(t => t.mastery_level === 'high' || t.difficulty_unlocked === 'completed')) {
      earned.add('course_champion');
    }
  });

  if (streak >= 3)  earned.add('streak_starter');
  if (streak >= 7)  earned.add('dedicated_learner');
  if (streak >= 14) earned.add('unstoppable');
  if (streak >= 30) earned.add('invincible');

  const retriedAndPassed = quizSessions.some(s => s.passed && failedTopics.has(s.topic_id));
  if (retriedAndPassed) earned.add('never_give_up');

  const topicScores = {};
  quizSessions.forEach(s => {
    if (!topicScores[s.topic_id]) topicScores[s.topic_id] = [];
    topicScores[s.topic_id].push(s.score);
  });
  Object.values(topicScores).forEach(scores => {
    if (scores.some(s => s < 80) && scores.some(s => s >= 80)) {
      earned.add('comeback_kid');
    }
  });

  if (chatHistory && chatHistory.length > 0) earned.add('curious_mind');
  if (quizSessions.some(s => s.session_type)) earned.add('hint_seeker');

  return earned;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getMasteryColor = (topic) => {
  if (!topic?.is_unlocked) return Colors.mastery.locked;
  const level = topic.mastery_level;
  if (level === 'high' || topic.difficulty_unlocked === 'completed') return Colors.mastery.high;
  if (level === 'medium') return Colors.mastery.medium;
  return Colors.mastery.low;
};

const getMasteryLabel = (topic) => {
  if (!topic?.is_unlocked) return 'Locked';
  if (topic.mastery_level === 'high' || topic.difficulty_unlocked === 'completed') return 'Mastered';
  if (topic.mastery_level === 'medium') return 'In Progress';
  return 'In Progress';
};

const formatTimestamp = (ts) => {
  if (!ts) return '';
  try {
    const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }) + ' at ' + date.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch {
    return '';
  }
};

const BADGE_CATEGORIES = [...new Set(ALL_BADGES.map(b => b.category))];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProgressScreen({ navigation }) {
  const { theme } = useTheme();

  const [activeTab, setActiveTab]           = useState('dashboard');
  const [userData, setUserData]             = useState(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState([]);
  const [allTopicsData, setAllTopicsData]   = useState([[], []]);
  const [quizSessions, setQuizSessions]     = useState([]);
  const [, setChatHistory]                  = useState([]);
  const [earnedBadges, setEarnedBadges]     = useState(new Set());
  const [expandedCourses, setExpandedCourses] = useState({});
  const [loading, setLoading]               = useState(true);
  const [progressData, setProgressData]     = useState(null);
  const [chartError, setChartError]         = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const userDoc = await getDoc(doc(db, 'users', userId));
      const uData = userDoc.exists() ? userDoc.data() : null;
      setUserData(uData);
      const enrolledIds = uData?.enrolled_courses || uData?.courses || [];
      setEnrolledCourseIds(enrolledIds);

      const topicsResults = await Promise.allSettled([
        getLearningState(userId, COURSE_ID_COS201),
        getLearningState(userId, COURSE_ID_CSC301),
      ]);
      const topicsData = topicsResults.map(r =>
        r.status === 'fulfilled' ? (r.value?.topics || []) : []
      );
      setAllTopicsData(topicsData);

      try {
        const progress = await getFullProgress(userId);
        setProgressData(progress);
      } catch {
        setProgressData(null);
      }

      let sessions = [];
      try {
        // Try with orderBy first (requires composite index)
        const sessionsQuery = query(
          collection(db, 'quiz_sessions'),
          where('user_id', '==', userId),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const sessionsSnap = await getDocs(sessionsQuery);
        sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setQuizSessions(sessions);
      } catch (indexError) {
        // Fallback: fetch without orderBy, sort in JS
        try {
          const sessionsQuery = query(
            collection(db, 'quiz_sessions'),
            where('user_id', '==', userId),
            limit(100)
          );
          const sessionsSnap = await getDocs(sessionsQuery);
          sessions = sessionsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => {
              const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
              const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
              return bTime - aTime;
            });
          setQuizSessions(sessions);
        } catch (e) {
          console.log('Quiz sessions fetch failed:', e);
          setQuizSessions([]);
        }
      }

      let chatData = [];
      try {
        const sessionsRef = collection(db, 'chat_history', userId, 'sessions');
        const sessionSnap = await getDocs(query(sessionsRef, limit(1)));
        if (!sessionSnap.empty) {
          chatData = [{ hasSessions: true }];
        } else {
          const oldRef = collection(db, 'chat_history', userId, 'messages');
          const oldSnap = await getDocs(query(oldRef, limit(1)));
          chatData = oldSnap.docs.map(d => d.data());
        }
        setChatHistory(chatData);
      } catch {
        setChatHistory([]);
      }

      const earned = checkEarnedBadges(uData, topicsData, sessions, chatData);
      setEarnedBadges(earned);
    } catch (error) {
      console.error('ProgressScreen fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAllData();
    }, [fetchAllData])
  );

  useEffect(() => {
    if (quizSessions.length > 0) {
      setChartError(false);
    }
  }, [quizSessions]);

  // ── Computed Values ────────────────────────────────────────────────────────

  const dayLabel = (count) => count === 1 ? 'day' : 'days';

  const allTopics      = allTopicsData.flat();
  const totalTopics    = allTopics.length;
  const masteredTopics = allTopics.filter(
    t => t.mastery_level === 'high' || t.difficulty_unlocked === 'completed'
  ).length;
  const avgScore       = progressData?.average_score || 0;
  const currentStreak  = userData?.login_streak || 0;
  const longestStreak  = userData?.longest_streak || 0;

  // ── Tab Helpers ────────────────────────────────────────────────────────────

  const TABS = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'history',   label: 'Quiz History' },
    { key: 'chart',     label: 'Chart' },
    { key: 'badges',    label: 'Badges' },
  ];

  const toggleCourse = (courseId) => {
    setExpandedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  // ── Topic Lookup ───────────────────────────────────────────────────────────

  const findTopicTitle = (topicId) => {
    for (const courseTopics of allTopicsData) {
      const found = courseTopics.find(t => t.topic_id === topicId || t.id === topicId);
      if (found) return found.title || found.topic_title || 'Unknown Topic';
    }
    return 'Unknown Topic';
  };

  // ── Chart Data ─────────────────────────────────────────────────────────────

  const chartSessions = [...quizSessions].reverse().slice(-7);
  const chartLabels   = chartSessions.map((_, i) => `Q${i + 1}`);
  const chartScores   = chartSessions.map(s => s.score || 0);

  const barChartData = {
    labels: chartLabels.length > 0 ? chartLabels : ['—'],
    datasets: [{ data: chartScores.length > 0 ? chartScores : [0] }],
  };

  const baseChartConfig = (colorFn) => ({
    backgroundColor: theme.surface,
    backgroundGradientFrom: theme.surface,
    backgroundGradientTo: theme.surface,
    color: colorFn,
    labelColor: (opacity = 1) => `rgba(74, 101, 114, ${opacity})`,
    style: { borderRadius: 8 },
    propsForDots: { r: '4' },
  });

  // ── Render Sections ────────────────────────────────────────────────────────

  const renderDashboard = () => (
    <View>
      {/* Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View>
            <Text style={styles.streakValue}>{currentStreak} {dayLabel(currentStreak)} Streak</Text>
            <Text style={styles.streakSub}>Longest: {longestStreak} {dayLabel(longestStreak)}</Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <Text style={styles.statValue}>{masteredTopics}/{totalTopics}</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Topics Mastered</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <Text style={styles.statValue}>{Math.round(avgScore)}%</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Avg. Quiz Score</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.statValue, { color: Colors.accent }]}>{earnedBadges.size}/18</Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Badges</Text>
        </View>
      </View>

      {/* Mastery Overview */}
      <Text style={[styles.sectionHeader, { color: theme.text }]}>Mastery by Course</Text>

      {ALL_COURSES
        .filter(course => enrolledCourseIds.includes(course.id))
        .map((course) => {
        const courseIndex = ALL_COURSES.indexOf(course);
        const courseTopics = allTopicsData[courseIndex] || [];
        const courseMastered = courseTopics.filter(
          t => t.mastery_level === 'high' || t.difficulty_unlocked === 'completed'
        ).length;
        const courseTotal = courseTopics.length;
        const progress = courseTotal > 0 ? courseMastered / courseTotal : 0;
        const isExpanded = !!expandedCourses[course.id];

        return (
          <View key={course.id} style={[styles.courseCard, { backgroundColor: theme.surface }]}>
            <TouchableOpacity
              style={styles.courseHeader}
              onPress={() => toggleCourse(course.id)}
              activeOpacity={0.7}
            >
              <View style={styles.courseHeaderLeft}>
                <View style={styles.courseCodeBadge}>
                  <Text style={styles.courseCodeText}>{course.code}</Text>
                </View>
                <Text style={[styles.courseTitleText, { color: theme.text }]} numberOfLines={1}>
                  {course.title}
                </Text>
              </View>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                {courseMastered} of {courseTotal} topics
              </Text>
            </View>

            {/* Expanded Topic List */}
            {isExpanded && courseTopics.map((topic, ti) => {
              const dot  = getMasteryColor(topic);
              const label = getMasteryLabel(topic);
              return (
                <View
                  key={topic.topic_id || topic.id || ti}
                  style={[styles.topicRow, { borderTopColor: theme.border }]}
                >
                  <View style={[styles.masteryDot, { backgroundColor: dot }]} />
                  <Text style={[styles.topicName, { color: theme.text }]} numberOfLines={1}>
                    {topic.title || topic.topic_title || 'Topic'}
                  </Text>
                  <View style={[styles.masteryBadge, { backgroundColor: dot + '22' }]}>
                    <Text style={[styles.masteryBadgeText, { color: dot }]}>{label}</Text>
                  </View>
                </View>
              );
            })}

            {isExpanded && courseTopics.length === 0 && (
              <Text style={[styles.emptyTopics, { color: theme.textSecondary }]}>
                No topics loaded.
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderHistory = () => {
    if (quizSessions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            No quiz history yet. Take your first quiz to see results here.
          </Text>
        </View>
      );
    }

    return (
      <View>
        {quizSessions.map((session) => {
          const scoreColor = (session.score || 0) >= 80 ? Colors.success : Colors.danger;
          const topicTitle = findTopicTitle(session.topic_id);
          const courseCode = ALL_COURSES.find(c => c.id === session.course_id)?.code || '';
          const difficultyLabel =
            session.difficulty === 'hard' ? 'Level 2' :
            session.difficulty === 'completed' ? 'Completed' : 'Level 1';

          const handleRetake = () => {
            navigation.navigate('QuizScreen', {
              topicId:     session.topic_id,
              topicTitle,
              courseId:    session.course_id,
              difficulty:  session.difficulty === 'completed' ? 'hard' : (session.difficulty || 'easy'),
              sessionType: 'seeded',
            });
          };

          return (
            <View
              key={session.id}
              style={[styles.sessionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              {/* Top Row */}
              <View style={styles.sessionTopRow}>
                {courseCode ? (
                  <View style={styles.courseCodeBadge}>
                    <Text style={styles.courseCodeText}>{courseCode}</Text>
                  </View>
                ) : null}
                <Text style={[styles.sessionTopic, { color: theme.text }]} numberOfLines={1}>
                  {topicTitle}
                </Text>
                <Text style={[styles.sessionTimestamp, { color: theme.textSecondary }]}>
                  {formatTimestamp(session.timestamp)}
                </Text>
              </View>

              {/* Score Row */}
              <View style={styles.sessionScoreRow}>
                <Text style={[styles.sessionScore, { color: scoreColor }]}>
                  {Math.round(session.score || 0)}%
                </Text>
                <View style={[styles.passedBadge, { backgroundColor: scoreColor + '22' }]}>
                  <Text style={[styles.passedBadgeText, { color: scoreColor }]}>
                    {session.passed ? 'Passed' : 'Failed'}
                  </Text>
                </View>
                <View style={[styles.difficultyPill, { borderColor: theme.border }]}>
                  <Text style={[styles.difficultyPillText, { color: theme.textSecondary }]}>
                    {difficultyLabel}
                  </Text>
                </View>
              </View>

              {/* Questions Row */}
              <Text style={[styles.sessionCorrect, { color: theme.textSecondary }]}>
                {session.correct_count ?? '—'} of {session.total_questions ?? '—'} correct
              </Text>

              {/* Retake Button */}
              <TouchableOpacity style={styles.retakeBtn} onPress={handleRetake}>
                <Text style={styles.retakeBtnText}>Retake →</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    );
  };

  const renderChart = () => {
    if (quizSessions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
            Complete some quizzes to see your performance charts.
          </Text>
        </View>
      );
    }

    if (chartError) {
      return (
        <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 20 }}>
          Charts unavailable on this device. Check Quiz History tab for your scores.
        </Text>
      );
    }

    return (
      <View>
        {/* Bar Chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.surface }]}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>Quiz Scores per Attempt</Text>
          <BarChart
            data={barChartData}
            width={width - 64}
            height={200}
            chartConfig={baseChartConfig((opacity = 1) => `rgba(21, 124, 142, ${opacity})`)}
            style={styles.chartStyle}
            fromZero
            showValuesOnTopOfBars
          />
        </View>

        {/* Line Chart */}
        <View style={[styles.chartCard, { backgroundColor: theme.surface, marginTop: 16 }]}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>Score Improvement Over Time</Text>
          <LineChart
            data={barChartData}
            width={width - 64}
            height={200}
            bezier
            chartConfig={baseChartConfig((opacity = 1) => `rgba(232, 160, 32, ${opacity})`)}
            style={styles.chartStyle}
            fromZero
          />
        </View>
      </View>
    );
  };

  const renderBadges = () => {
    const earnedList = ALL_BADGES.filter(b => earnedBadges.has(b.id));

    return (
      <View>
        {/* Your Badges */}
        <View style={styles.badgeSectionHeader}>
          <Text style={[styles.sectionHeader, { color: theme.text, marginBottom: 0 }]}>
            Your Badges
          </Text>
          <View style={[styles.countBadge, { backgroundColor: Colors.primary }]}>
            <Text style={styles.countBadgeText}>{earnedBadges.size}</Text>
          </View>
        </View>

        {earnedList.length === 0 ? (
          <Text style={[styles.emptyStateText, { color: theme.textSecondary, textAlign: 'center', marginVertical: 16 }]}>
            No badges yet — keep learning to earn your first badge!
          </Text>
        ) : (
          <View style={styles.earnedBadgesGrid}>
            {earnedList.map(badge => (
              <View key={badge.id} style={[styles.earnedBadgeCard, { backgroundColor: theme.surface }]}>
                <Text style={styles.earnedBadgeEmoji}>{badge.emoji}</Text>
                <Text style={[styles.earnedBadgeName, { color: Colors.primary }]}>{badge.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* All Badges by Category */}
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.sectionHeader, { color: theme.text }]}>All Badges</Text>

        {BADGE_CATEGORIES.map(category => (
          <View key={category} style={styles.badgeCategorySection}>
            <Text style={[styles.badgeCategoryHeader, { color: theme.textSecondary }]}>
              {category.toUpperCase()}
            </Text>
            {ALL_BADGES.filter(b => b.category === category).map((badge, idx, arr) => {
              const isEarned = earnedBadges.has(badge.id);
              return (
                <View
                  key={badge.id}
                  style={[
                    styles.badgeRow,
                    { backgroundColor: theme.surface, opacity: isEarned ? 1 : 0.6 },
                    idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={styles.badgeRowEmoji}>{badge.emoji}</Text>
                  <View style={styles.badgeRowInfo}>
                    <Text style={[styles.badgeRowName, { color: theme.text }]}>{badge.name}</Text>
                    <Text style={[styles.badgeRowDef, { color: theme.textSecondary }]}>
                      {badge.definition}
                    </Text>
                  </View>
                  <Ionicons
                    name={isEarned ? 'checkmark-circle' : 'lock-closed'}
                    size={20}
                    color={isEarned ? Colors.success : '#9CA3AF'}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Fixed Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Progress</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Track your progress on AdaptiveTutor
        </Text>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive, !isActive && { color: theme.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'history'   && renderHistory()}
          {activeTab === 'chart'     && renderChart()}
          {activeTab === 'badges'    && renderBadges()}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  // Tab Bar
  tabBar: {
    borderBottomWidth: 1,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabPillActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Streak Card
  streakCard: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  streakSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.08)' },
    }),
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },

  // Section Header
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },

  // Course Card
  courseCard: {
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.08)' },
    }),
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  courseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  courseCodeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  courseCodeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  courseTitleText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  progressBarContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
  },

  // Topic Row
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    gap: 8,
  },
  masteryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topicName: {
    fontSize: 13,
    flex: 1,
  },
  masteryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  masteryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyTopics: {
    fontSize: 13,
    padding: 12,
    textAlign: 'center',
  },

  // Quiz History
  sessionCard: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  sessionTopic: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sessionTimestamp: {
    fontSize: 11,
    width: '100%',
  },
  sessionScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sessionScore: {
    fontSize: 26,
    fontWeight: '800',
  },
  passedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  passedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  difficultyPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  difficultyPillText: {
    fontSize: 11,
  },
  sessionCorrect: {
    fontSize: 12,
    marginBottom: 10,
  },
  retakeBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  retakeBtnText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  // Charts
  chartCard: {
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.08)' },
    }),
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  chartStyle: {
    borderRadius: 8,
    marginLeft: -8,
  },

  // Badges
  badgeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  earnedBadgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  earnedBadgeCard: {
    width: (width / 3) - 20,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      web: { boxShadow: '0px 2px 6px rgba(0,0,0,0.08)' },
    }),
  },
  earnedBadgeEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  earnedBadgeName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  badgeCategorySection: {
    marginBottom: 16,
  },
  badgeCategoryHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  badgeRowEmoji: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  badgeRowInfo: {
    flex: 1,
  },
  badgeRowName: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeRowDef: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },

  // Empty State
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
