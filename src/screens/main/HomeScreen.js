import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../constants/ThemeContext';
import { auth, db } from '../../services/firebase';
import { getLearningState, getFullProgress, updateStreak } from '../../services/api';
import { COURSE_ID_COS201, COURSE_ID_CSC301 } from '../../constants/courseIds';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMARY  = '#157C8E';
const ACCENT   = '#E8A020';
const INACTIVE = '#9CA3AF';

const COURSES_META = [
  { id: COURSE_ID_COS201, code: 'COS201', title: 'Computer Programming I' },
  { id: COURSE_ID_CSC301, code: 'CSC301', title: 'Data Structures & Algorithms' },
];

const TIPS = [
  'Write code every day — even 15 minutes of practice compounds into mastery over a semester.',
  'Before debugging, read the error message carefully. The answer is usually right there.',
  'Object-Oriented Programming is about modelling real-world relationships — think in objects, not just functions.',
  'When stuck, explain your code out loud. You\'ll often find the bug before finishing your sentence.',
  'A clean variable name is better than a comment. Name things so clearly that comments become redundant.',
  'Master the basics: arrays, loops, and conditionals before jumping to frameworks and libraries.',
  'Testing your code isn\'t extra work — it\'s how you stop future-you from hunting mystery bugs at midnight.',
  'The best programmers aren\'t those who never make mistakes; they\'re those who find and fix them fastest.',
];

// Pick one tip per app session (stable across renders)
const DAILY_TIP = TIPS[new Date().getDate() % TIPS.length];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}

// Simple deterministic colour from a string so initials circle looks varied
function initialsColor(name = '') {
  const palette = ['#157C8E', '#E8A020', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProgressBar({ pct, color = PRIMARY, height = 6 }) {
  return (
    <View style={[pbStyles.track, { height }]}>
      <View style={[pbStyles.fill, { width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color, height }]} />
    </View>
  );
}

const pbStyles = StyleSheet.create({
  track: { backgroundColor: '#E5EEF0', borderRadius: 99, overflow: 'hidden', width: '100%' },
  fill:  { borderRadius: 99 },
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { theme, isDark } = useTheme();

  const [loading,       setLoading]       = useState(true);
  const [userName,      setUserName]      = useState('');
  const [streak,        setStreak]        = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [topicsMastered,setTopicsMastered]= useState(0);
  const [totalTopics,   setTotalTopics]   = useState(0);
  const [avgScore,      setAvgScore]      = useState(0);
  const [activeTopic,     setActiveTopic]     = useState(null); // { courseCode, title, pct }
  const [courseProgress,  setCourseProgress]  = useState([]);   // [{ code, title, done, total }]
  const [coursesProgress, setCoursesProgress] = useState({});   // { [courseId]: { totalTopics, masteredTopics, progressPercent } }
  const [enrolledIds,     setEnrolledIds]     = useState([]);   // course IDs from student_progress

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [])
  );

  async function fetchAll() {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const uid = user.uid;

      // Fetch enrolled course IDs from student_progress
      const progressQuery = query(
        collection(db, 'student_progress'),
        where('user_id', '==', uid)
      );
      const progressSnap = await getDocs(progressQuery);
      const enrolledFromProgress = [...new Set(
        progressSnap.docs.map(d => d.data().course_id).filter(Boolean)
      )];

      // Run independent calls in parallel
      const [userSnap, progressData, stateResults] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getFullProgress(uid).catch(() => null),
        Promise.all(
          COURSES_META.map(c =>
            getLearningState(uid, c.id)
              .then(res => ({ ...res, courseMeta: c }))
              .catch(() => null)
          )
        ),
      ]);

      // Streak update (fire-and-forget, non-blocking)
      updateStreak(uid).catch(() => {});

      // Build per-course progress from getLearningState topics
      const newCoursesProgress = {};
      for (const state of stateResults) {
        if (!state) continue;
        const topics = state.topics || [];
        const totalTopics = topics.length;
        const masteredTopics = topics.filter(t =>
          t.mastery_level === 'high' || t.difficulty_unlocked === 'completed'
        ).length;
        const progressPercent = totalTopics > 0
          ? Math.round((masteredTopics / totalTopics) * 100)
          : 0;
        newCoursesProgress[state.courseMeta.id] = { totalTopics, masteredTopics, progressPercent };
      }
      setCoursesProgress(newCoursesProgress);

      // User document — also merge enrolled_courses for immediate visibility
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserName(data.name ?? data.display_name ?? '');
        setStreak(data.login_streak ?? 0);
        setLongestStreak(data.longest_streak ?? 0);
        const enrolledFromDoc = data.enrolled_courses || [];
        const merged = [...new Set([...enrolledFromProgress, ...enrolledFromDoc])];
        setEnrolledIds(merged);
      } else {
        setEnrolledIds(enrolledFromProgress);
      }

      // Full progress
      if (progressData) {
        setTopicsMastered(progressData.topics_mastered ?? 0);
        setTotalTopics(progressData.total_topics ?? 0);
        setAvgScore(
          typeof progressData.average_score === 'number'
            ? Math.round(progressData.average_score)
            : 0
        );

        // Per-course progress breakdown
        const perCourse = COURSES_META.map(meta => {
          const found = progressData.courses?.find(c => c.course_id === meta.id);
          return {
            id:    meta.id,
            code:  meta.code,
            title: meta.title,
            done:  found?.topics_mastered ?? 0,
            total: found?.total_topics    ?? 0,
          };
        });
        setCourseProgress(perCourse);
      }

      // Last active topic across all enrolled courses
      let best = null;
      for (const state of stateResults) {
        if (!state) continue;
        const topic = state.current_topic ?? state.last_active_topic ?? state.active_topic;
        if (topic) {
          const pct = typeof state.completion_percentage === 'number'
            ? Math.round(state.completion_percentage)
            : 0;
          if (!best || pct > best.pct) {
            best = {
              courseCode: state.courseMeta.code,
              title: topic.title ?? topic.name ?? 'Continue topic',
              pct,
            };
          }
        }
      }
      setActiveTopic(best);

    } catch (e) {
      // Graceful fallback — state already initialised to zeros
    } finally {
      setLoading(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  const dayLabel = (count) => count === 1 ? 'day' : 'days';

  // ── Derived ────────────────────────────────────────────────────────────────

  const firstName  = userName.trim().split(/\s+/)[0] || 'Student';
  const initials   = getInitials(userName) || '?';
  const avatarBg   = initialsColor(userName);
  const greeting   = `${getGreeting()}, ${firstName} 👋`;

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[{ flex: 1 }, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLogo}>🎓</Text>
            <Text style={[styles.headerTitle, { color: PRIMARY }]}>AdaptiveTutor</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={[styles.greeting, { color: theme.text }]}>Good to see you 👋</Text>
          </View>
          {/* Streak card skeleton */}
          <View style={[styles.skeletonBlock, {
            marginHorizontal: 18, marginTop: 20,
            height: 80, borderRadius: 14, backgroundColor: theme.border,
          }]} />
          {/* Stats row skeleton */}
          <View style={{ flexDirection: 'row', marginHorizontal: 18, marginTop: 16, gap: 12 }}>
            <View style={[styles.skeletonBlock, { flex: 1, height: 70, borderRadius: 14, backgroundColor: theme.border }]} />
            <View style={[styles.skeletonBlock, { flex: 1, height: 70, borderRadius: 14, backgroundColor: theme.border }]} />
          </View>
          {/* Continue card skeleton */}
          <View style={styles.section}>
            <View style={[styles.skeletonBlock, { height: 56, borderRadius: 14, backgroundColor: theme.border, marginBottom: 20 }]} />
          </View>
          {/* Course card skeleton */}
          <View style={styles.section}>
            <View style={[styles.skeletonBlock, { height: 90, borderRadius: 14, backgroundColor: theme.border }]} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerLogo}>🎓</Text>
          <Text style={[styles.headerTitle, { color: PRIMARY }]}>AdaptiveTutor</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Welcome ── */}
      <View style={styles.section}>
        <Text style={[styles.greeting, { color: theme.text }]}>{greeting}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Ready to continue learning?</Text>
      </View>

      {/* ── Streak card ── */}
      <TouchableOpacity
        style={styles.streakCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Progress')}
      >
        <View style={styles.streakLeft}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View>
            <Text style={styles.streakValue}>{streak} {dayLabel(streak)} Streak</Text>
            <Text style={styles.streakSub}>Longest: {longestStreak} {dayLabel(longestStreak)}</Text>
          </View>
        </View>
        <Text style={styles.streakCta}>Keep it up! →</Text>
      </TouchableOpacity>

      {/* ── Quick stats ── */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Progress')}
      >
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: PRIMARY }]}>{topicsMastered}</Text>
            <Text style={[styles.statLabel, { color: INACTIVE }]}>Topics Mastered</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statNumber, { color: PRIMARY }]}>{avgScore}%</Text>
            <Text style={[styles.statLabel, { color: INACTIVE }]}>Avg. Quiz Score</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Continue Learning ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Continue Learning</Text>
        <TouchableOpacity
          style={[styles.continueCard, { backgroundColor: theme.card }]}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Learn')}
        >
          {activeTopic ? (
            <>
              <View style={styles.continueTop}>
                <View style={styles.courseBadge}>
                  <Text style={styles.courseBadgeText}>{activeTopic.courseCode}</Text>
                </View>
                <Text style={[styles.continueTitle, { color: theme.text }]} numberOfLines={2}>
                  {activeTopic.title}
                </Text>
              </View>
              <View style={styles.continueBottom}>
                <ProgressBar pct={activeTopic.pct} />
                <Text style={[styles.continuePct, { color: theme.textSecondary }]}>
                  {activeTopic.pct}% complete
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.continueEmpty}>
              <Ionicons name="book-outline" size={28} color={PRIMARY} />
              <View>
                <Text style={[styles.continueEmptyText, { color: PRIMARY }]}>
                  Go to My Lessons →
                </Text>
                <Text style={[styles.continueEmptySub, { color: theme.textSecondary }]}>
                  Explore your courses and start learning
                </Text>
              </View>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Daily tip ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Tip</Text>
        <View style={[styles.tipCard, { backgroundColor: isDark ? '#0E2A30' : '#E8F4F6' }]}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={[styles.tipText, { color: PRIMARY }]}>{DAILY_TIP}</Text>
        </View>
      </View>

      {/* ── Enrolled courses ── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Courses</Text>
        {COURSES_META.filter(c => enrolledIds.length === 0 || enrolledIds.includes(c.id)).map(course => (
          <TouchableOpacity
            key={course.id}
            style={[styles.courseCard, { backgroundColor: theme.card }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Learn')}
          >
            <View style={styles.courseTop}>
              <View style={styles.courseBadge}>
                <Text style={styles.courseBadgeText}>{course.code}</Text>
              </View>
              <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={1}>
                {course.title}
              </Text>
            </View>
            <View style={styles.courseMiddle}>
              <ProgressBar pct={coursesProgress[course.id]?.progressPercent || 0} />
            </View>
            <View style={styles.courseBottom}>
              <Text style={[styles.courseProgress, { color: theme.textSecondary }]}>
                {coursesProgress[course.id]?.masteredTopics || 0} of {coursesProgress[course.id]?.totalTopics || 0} topics completed
              </Text>
              <Text style={[styles.courseContinue, { color: PRIMARY }]}>Continue →</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  skeletonBlock: {
    opacity: 0.5,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLogo: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Welcome
  section: {
    paddingHorizontal: 18,
    marginTop: 20,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },

  // Streak
  streakCard: {
    marginHorizontal: 18,
    marginTop: 20,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
      web: { boxShadow: '0px 4px 8px rgba(21,124,142,0.35)' },
    }),
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  streakEmoji: {
    fontSize: 28,
  },
  streakValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  streakSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
  },
  streakCta: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Quick stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
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
  statNumber: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Continue Learning
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  continueCard: {
    borderRadius: 14,
    padding: 16,
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
  continueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  continueTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  continueBottom: {
    gap: 6,
  },
  continuePct: {
    fontSize: 12,
  },
  continueEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  continueEmptyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  continueEmptySub: {
    fontSize: 12,
    marginTop: 3,
  },

  // Course badge (reused)
  courseBadge: {
    backgroundColor: PRIMARY,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  courseBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Tip
  tipCard: {
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipIcon: {
    fontSize: 22,
    marginTop: 1,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
  },

  // Enrolled courses
  courseCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
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
  courseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  courseTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  courseMiddle: {
    marginBottom: 10,
  },
  courseBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseProgress: {
    fontSize: 12,
  },
  courseContinue: {
    fontSize: 13,
    fontWeight: '700',
  },

  bottomPad: {
    height: 12,
  },
});
