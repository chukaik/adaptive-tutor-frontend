/**
 * LearnScreen.js
 *
 * NOTE: CourseScreen and TopicScreen are NOT tab screens.
 * They must be registered in MainNavigator as Stack screens so that
 * navigation.navigate('CourseScreen', ...) and navigation.navigate('TopicScreen', ...)
 * work correctly from this tab screen.
 */

import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { auth, db } from '../../services/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import { getLearningState } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { COURSE_ID_COS201, COURSE_ID_CSC301 } from '../../constants/courseIds';

// ---------------------------------------------------------------------------
// Static course catalogue
// ---------------------------------------------------------------------------
const ALL_COURSES = [
  {
    id: COURSE_ID_COS201,
    code: 'COS201',
    title: 'Computer Programming I',
    description: '8 topics — Java programming fundamentals to exception handling',
    faculty: 'Faculty of Science',
  },
  {
    id: COURSE_ID_CSC301,
    code: 'CSC301',
    title: 'Data Structures',
    description: '6 topics — Arrays, stacks, queues, trees, linked lists and algorithms in C++',
    faculty: 'Faculty of Science',
  },
];

// ---------------------------------------------------------------------------
// Placeholder topics for unenrolled courses in the All Courses section
// ---------------------------------------------------------------------------
const PLACEHOLDER_TOPICS = {
  [COURSE_ID_COS201]: [
    'Introduction to Programming',
    'Java Data Types, Variables & Operators',
    'Control Structures & Arrays',
    'Object-Oriented Programming Concepts',
    'Class Hierarchies & Packages',
    'Strings & String Processing',
    'APIs, Collections, Searching & Sorting',
    'Recursion & Exception Handling',
  ],
  [COURSE_ID_CSC301]: [
    'Introduction to Data Structures & Primitive Types',
    'Strings & String Processing',
    'Memory, Stacks & Queues',
    'Trees',
    'Pointers, References & Linked Structures',
    'Algorithms — Searching & Sorting',
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function isCourseCompleted(topics = []) {
  return topics.length > 0 && topics.every(t => t.mastery_level === 'high');
}

function masteryBadgeStyle(masteryLevel, isUnlocked) {
  if (!isUnlocked) return { label: 'Locked', bg: Colors.mastery.locked, text: '#fff' };
  if (masteryLevel === 'high') return { label: 'Mastered', bg: Colors.success, text: '#fff' };
  return { label: 'In Progress', bg: Colors.warning, text: '#fff' };
}

function topicIconName(isUnlocked, masteryLevel) {
  if (!isUnlocked) return 'lock-closed';
  if (masteryLevel === 'high') return 'checkmark-circle';
  return 'lock-open';
}

function topicIconColor(isUnlocked, masteryLevel) {
  if (!isUnlocked) return Colors.mastery.locked;
  if (masteryLevel === 'high') return Colors.accent;
  return Colors.primary;
}

// ---------------------------------------------------------------------------
// Sub-component: TopicRow
// Tappable when topic.is_unlocked === true AND topic.topic_id is not null.
// Renders as a plain View (locked, grey) otherwise.
// ---------------------------------------------------------------------------
function TopicRow({ topic, courseId, navigation, theme }) {
  const tappable = topic.is_unlocked === true && topic.topic_id !== null;
  const badge = masteryBadgeStyle(topic.mastery_level, tappable);
  const iconName = topicIconName(tappable, topic.mastery_level);
  const iconColor = topicIconColor(tappable, topic.mastery_level);

  const rowContent = (
    <>
      <Ionicons name={iconName} size={18} color={iconColor} style={styles.topicIcon} />
      <Text
        style={[styles.topicTitle, { color: tappable ? theme.text : theme.textSecondary }]}
        numberOfLines={2}
      >
        {topic.topic_title}
      </Text>
      <View style={[styles.masteryBadge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.masteryBadgeText, { color: badge.text }]}>{badge.label}</Text>
      </View>
    </>
  );

  if (tappable) {
    return (
      <TouchableOpacity
        style={styles.topicRow}
        onPress={() =>
          navigation.navigate('TopicScreen', {
            topicId: topic.topic_id,
            topicTitle: topic.topic_title || topic.title,
            courseId,
            difficulty: topic.difficulty_unlocked || 'easy',
          })
        }
        activeOpacity={0.7}
      >
        {rowContent}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.topicRow, styles.topicRowLocked]}>
      {rowContent}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: CourseCard
// Shared by both "Your Courses" and "All Courses" sections.
// showDescription=true renders faculty + description (used in All Courses).
// ---------------------------------------------------------------------------
function CourseCard({ course, topics, isEnrolled, isExpanded, onToggleExpand, navigation, theme, showDescription = false }) {
  const totalTopics = topics.length;
  const masteredCount = topics.filter(t => t.mastery_level === 'high').length;
  const progress = totalTopics > 0 ? masteredCount / totalTopics : 0;

  const handleHeaderPress = () => {
    navigation.navigate('CourseScreen', {
      courseId: course.id,
      courseCode: course.code,
      courseTitle: course.title,
    });
  };

  const showChevron = totalTopics > 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {/* ---- Course header row ---- */}
      <View style={styles.cardHeader}>
        {/* Tappable main area → CourseScreen */}
        <TouchableOpacity style={styles.cardHeaderMain} onPress={handleHeaderPress} activeOpacity={0.7}>
          <View style={styles.codeBadge}>
            <Text style={styles.codeBadgeText}>{course.code}</Text>
          </View>

          <View style={styles.cardHeaderCenter}>
            <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={1}>
              {course.title}
            </Text>

            {/* All Courses variant: show faculty + description */}
            {showDescription && (
              <>
                <Text style={[styles.courseFaculty, { color: Colors.primary }]} numberOfLines={1}>
                  {course.faculty}
                </Text>
                <Text style={[styles.courseDescription, { color: theme.textSecondary }]} numberOfLines={2}>
                  {course.description}
                </Text>
              </>
            )}

            {/* Progress bar for enrolled courses */}
            {isEnrolled && totalTopics > 0 && (
              <View style={styles.progressRow}>
                <View style={[styles.progressBarTrack, { backgroundColor: theme.border }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.round(progress * 100)}%`, backgroundColor: Colors.primary },
                    ]}
                  />
                </View>
                <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>
                  {masteredCount}/{totalTopics} completed
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Right side: chevron */}
        <View style={styles.cardHeaderRight}>
          {showChevron && (
            <TouchableOpacity
              onPress={onToggleExpand}
              style={styles.chevronButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ---- Topic dropdown ---- */}
      {isExpanded && totalTopics > 0 && (
        <View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          {topics.map((topic, index) => (
            <TopicRow
              key={topic.topic_id ?? `placeholder-${index}`}
              topic={topic}
              courseId={course.id}
              navigation={navigation}
              theme={theme}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: SectionHeader
// ---------------------------------------------------------------------------
function SectionHeader({ title, subtitle, theme }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function LearnScreen({ navigation }) {
  const { theme } = useTheme();

  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [courseTopics, setCourseTopics] = useState({});
  const [expandedCourses, setExpandedCourses] = useState({});
  const [loading, setLoading] = useState(true);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState([]);
  const [activeCourseIds, setActiveCourseIds] = useState(new Set());
  const [completedCourseIds, setCompletedCourseIds] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  // ---- fetchData defined outside useFocusEffect so both useEffects can call it ----
  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const [results, userDoc, progressSnap] = await Promise.all([
        Promise.allSettled(
          ALL_COURSES.map(course => getLearningState(userId, course.id))
        ),
        getDoc(doc(db, 'users', userId)),
        getDocs(query(
          collection(db, 'student_progress'),
          where('user_id', '==', userId)
        )),
      ]);

      const userData = userDoc.data();
      const newEnrolledIds =
        userData?.enrolled_courses ||
        userData?.courses ||
        userData?.selected_courses ||
        userData?.enrolledCourses ||
        // If no enrolled field found, show all courses
        ALL_COURSES.map(c => c.id);

      console.log('User doc fields:', Object.keys(userData || {}));
      console.log('Enrolled IDs found:', newEnrolledIds);

      const userProgress = progressSnap.docs.map(d => d.data());

      const newActiveCourseIds = new Set(
        userProgress
          .filter(p => (p.attempts || 0) > 0 || p.difficulty_unlocked !== 'easy')
          .map(p => p.course_id)
      );

      const progressByCourse = {};
      userProgress.forEach(p => {
        if (!progressByCourse[p.course_id])
          progressByCourse[p.course_id] = [];
        progressByCourse[p.course_id].push(p);
      });

      const newCompletedCourseIds = new Set(
        Object.entries(progressByCourse)
          .filter(([, topics]) =>
            topics.length > 0 &&
            topics.every(t =>
              t.mastery_level === 'high' ||
              t.difficulty_unlocked === 'completed'
            )
          )
          .map(([courseId]) => courseId)
      );

      const newCourseTopics = {};
      results.forEach((result, index) => {
        const course = ALL_COURSES[index];
        if (result.status === 'fulfilled' && result.value?.topics?.length > 0) {
          newCourseTopics[course.id] = result.value.topics;
        } else {
          newCourseTopics[course.id] = (PLACEHOLDER_TOPICS[course.id] || []).map(title => ({
            topic_id: null,
            topic_title: title,
            is_unlocked: false,
            mastery_level: 'locked',
            difficulty_unlocked: 'easy',
          }));
        }
      });

      setCourseTopics(newCourseTopics);
      setEnrolledCourseIds(newEnrolledIds);
      setActiveCourseIds(newActiveCourseIds);
      setCompletedCourseIds(newCompletedCourseIds);
    } catch (_) {
      // silently handle — loading spinner will clear
    } finally {
      setLoading(false);
    }
  };

  // ---- Bump refreshKey on focus ----
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  // ---- Re-fetch whenever refreshKey changes ----
  useEffect(() => {
    fetchData();
  }, [refreshKey]);

  const toggleExpand = (courseId) => {
    setExpandedCourses(prev => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  // ---- Search filter (applied to both sections) ----
  const matchesCourse = (course) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const titleMatch = course.title.toLowerCase().includes(q);
    const codeMatch  = course.code.toLowerCase().includes(q);

    // Check static topic names
    const staticTopics = PLACEHOLDER_TOPICS[course.id] || [];
    const topicMatch = staticTopics.some(t => t.toLowerCase().includes(q));

    // Also check dynamically loaded topics if available
    const dynamicTopics = courseTopics[course.id] || [];
    const dynamicMatch = dynamicTopics.some(t =>
      (t.topic_title || t.title || '').toLowerCase().includes(q)
    );

    return titleMatch || codeMatch || topicMatch || dynamicMatch;
  };

  // ---- Your Courses section ----
  const enrolledCourses = ALL_COURSES.filter(c => enrolledCourseIds.includes(c.id) && matchesCourse(c));
  const activeTabCourses = enrolledCourses.filter(c =>
    activeCourseIds.has(c.id) && !completedCourseIds.has(c.id)
  );
  const completedTabCourses = enrolledCourses.filter(c =>
    completedCourseIds.has(c.id)
  );
  const tabCourses = activeTab === 'active' ? activeTabCourses : completedTabCourses;

  // ---- All Courses section (enrolled only) ----
  const allCoursesFiltered = ALL_COURSES.filter(c => enrolledCourseIds.includes(c.id) && matchesCourse(c));

  // ---- Render ----
  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Learn</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Gain the skills you need
        </Text>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search courses and topics..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ======================================================= */}
          {/* YOUR COURSES SECTION                                      */}
          {/* ======================================================= */}
          <SectionHeader
            title="Your Courses"
            subtitle={
              enrolledCourseIds.length === 0
                ? 'Not enrolled in any courses yet'
                : `${enrolledCourseIds.length} course${enrolledCourseIds.length !== 1 ? 's' : ''} enrolled`
            }
            theme={theme}
          />

          {/* Tab switcher */}
          <View style={[styles.tabContainer, { backgroundColor: theme.border }]}>
            {['active', 'completed'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.tabPill, activeTab === tab && { backgroundColor: Colors.primary }]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: activeTab === tab ? '#fff' : theme.textSecondary },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Tab content */}
          {tabCourses.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: theme.border }]}>
              <Ionicons name="book-outline" size={36} color={theme.border} style={{ marginBottom: 10 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {activeTab === 'active'
                  ? 'Start a lesson to see your active courses here.'
                  : 'Complete all topics in a course to see it here.'}
              </Text>
            </View>
          ) : (
            tabCourses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                topics={courseTopics[course.id] || []}
                isEnrolled
                isExpanded={!!expandedCourses[course.id]}
                onToggleExpand={() => toggleExpand(course.id)}
                navigation={navigation}
                theme={theme}
                showDescription={false}
              />
            ))
          )}

          {/* ======================================================= */}
          {/* SECTION DIVIDER                                           */}
          {/* ======================================================= */}
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

          {/* ======================================================= */}
          {/* ALL COURSES SECTION                                       */}
          {/* ======================================================= */}
          <SectionHeader
            title="All Courses"
            subtitle="Explore all available courses"
            theme={theme}
          />

          {allCoursesFiltered.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: theme.border }]}>
              <Ionicons name="search-outline" size={36} color={theme.border} style={{ marginBottom: 10 }} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No courses found for your search.
              </Text>
            </View>
          ) : (
            allCoursesFiltered.map(course => {
              const enrolled = enrolledCourseIds.includes(course.id);
              return (
                <CourseCard
                  key={`all-${course.id}`}
                  course={course}
                  topics={courseTopics[course.id] || []}
                  isEnrolled={enrolled}
                  isExpanded={!!expandedCourses[`all-${course.id}`]}
                  onToggleExpand={() => toggleExpand(`all-${course.id}`)}
                  navigation={navigation}
                  theme={theme}
                  showDescription
                />
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  // Search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },

  // Section headers
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.2,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  // Section divider
  sectionDivider: {
    height: 1,
    marginVertical: 24,
  },

  // Tab switcher
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    borderRadius: 10,
    padding: 3,
  },
  tabPill: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Course card
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 6px rgba(0,0,0,0.07)',
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  cardHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardHeaderCenter: {
    flex: 1,
    marginLeft: 10,
  },
  codeBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  codeBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  courseTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  courseFaculty: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  courseDescription: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    minWidth: 80,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  chevronButton: {
    paddingLeft: 4,
    alignSelf: 'center',
  },

  // Divider
  divider: {
    height: 1,
    marginHorizontal: 14,
  },

  // Topic row
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 14,
  },
  topicRowLocked: {
    opacity: 0.55,
  },
  topicIcon: {
    marginRight: 10,
    width: 20,
  },
  topicTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
  },
  masteryBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  masteryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
