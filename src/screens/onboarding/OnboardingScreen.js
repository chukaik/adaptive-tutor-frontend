import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform, TextInput,
} from 'react-native';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { completeOnboarding } from '../../services/api';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';
import { COURSE_ID_COS201, COURSE_ID_CSC301 } from '../../constants/courseIds';
// Static Data

const FACULTIES = [
  'Faculty of Law',
  'Faculty of Basic Social Science',
  'Faculty of Science',
  'Faculty of Basic Medical Science',
  'Faculty of Arts',
  'Faculty of Engineering',
];

const YEARS = ['1', '2', '3', '4', '5'];

const AVAILABLE_COURSES = [
  {
    id:          COURSE_ID_COS201,
    code:        'COS201',
    title:       'Computer Programming I',
    description: '8 topics covering programming fundamentals, Java data types, control structures, OOP, packages, strings, collections, searching, sorting, recursion and exception handling.',
  },
  {
    id:          COURSE_ID_CSC301,
    code:        'CSC301',
    title:       'Data Structures',
    description: '6 topics covering primitive types, arrays, strings, stacks, queues, trees, pointers, linked structures, searching and sorting algorithms using C++.',
  },
];

// Step Indicator

function StepIndicator({ currentStep, totalSteps, theme }) {
  return (
    <View style={indicatorStyles.container}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            indicatorStyles.dot,
            {
              backgroundColor: i <= currentStep ? Colors.primary : theme.border,
              width: i === currentStep ? 24 : 8,
            },
          ]}
        />
      ))}
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    marginBottom:  32,
  },
  dot: {
    height:       8,
    borderRadius: 4,
  },
});

// Option Button

function OptionButton({ label, selected, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[
        optionStyles.button,
        {
          backgroundColor: selected ? Colors.primary : theme.surface,
          borderColor:     selected ? Colors.primary : theme.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[
        optionStyles.label,
        { color: selected ? '#fff' : theme.text },
      ]}>
        {label}
      </Text>
      {selected && <Text style={optionStyles.check}>✓</Text>}
    </TouchableOpacity>
  );
}

const optionStyles = StyleSheet.create({
  button: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        14,
    borderRadius:   10,
    borderWidth:    1.5,
    marginBottom:   10,
  },
  label: {
    fontSize:   15,
    fontWeight: '500',
    flex:       1,
  },
  check: {
    color:      '#fff',
    fontWeight: 'bold',
    fontSize:   16,
  },
});

// Course Card

function CourseCard({ course, selected, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[
        courseStyles.card,
        {
          backgroundColor: selected ? `${Colors.primary}15` : theme.surface,
          borderColor:     selected ? Colors.primary : theme.border,
        },
      ]}
      onPress={onPress}
    >
      <View style={courseStyles.row}>
        <View style={[
          courseStyles.badge,
          { backgroundColor: selected ? Colors.primary : theme.border },
        ]}>
          <Text style={[
            courseStyles.badgeText,
            { color: selected ? '#fff' : theme.textSecondary },
          ]}>
            {course.code}
          </Text>
        </View>
        {selected && (
          <View style={courseStyles.checkBadge}>
            <Text style={courseStyles.checkText}>✓ Selected</Text>
          </View>
        )}
      </View>
      <Text style={[courseStyles.title, { color: theme.text }]}>
        {course.title}
      </Text>
      <Text style={[courseStyles.desc, { color: theme.textSecondary }]}>
        {course.description}
      </Text>
    </TouchableOpacity>
  );
}

const courseStyles = StyleSheet.create({
  card: {
    padding:      16,
    borderRadius: 12,
    borderWidth:  1.5,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    marginBottom:  8,
    gap:           8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      6,
  },
  badgeText: {
    fontSize:   12,
    fontWeight: 'bold',
  },
  checkBadge: {
    backgroundColor:  Colors.success,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      6,
  },
  checkText: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: 'bold',
  },
  title: {
    fontSize:     16,
    fontWeight:   'bold',
    marginBottom: 4,
  },
  desc: {
    fontSize:   13,
    lineHeight: 18,
  },
});

// Main Onboarding Screen

export default function OnboardingScreen({ onComplete, userId }) {
  const { theme, isDark } = useTheme();

  const [step,            setStep]            = useState(0);
  const [faculty,         setFaculty]         = useState('');
  const [courseOfStudy,   setCourseOfStudy]   = useState('');
  const [yearOfStudy,     setYearOfStudy]     = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');

  const styles     = makeStyles(theme, isDark);
  const totalSteps = 4;

  const steps = [
    {
      title:    'Select Your Faculty',
      subtitle: 'Which faculty are you in at Adeleke University?',
    },
    {
      title:    'Department / Course of Study',
      subtitle: 'Type in your department or course of study exactly as it appears in your school records.',
    },
    {
      title:    'Year of Study',
      subtitle: 'What year are you currently in?',
    },
    {
      title:    'Enroll in Courses',
      subtitle: 'Select the courses you want to study. More courses will be added over time.',
    },
  ];

  const canProceed = () => {
    if (step === 0) return faculty !== '';
    if (step === 1) return courseOfStudy.trim() !== '';
    if (step === 2) return yearOfStudy !== '';
    if (step === 3) return selectedCourses.length > 0;
    return false;
  };

  const handleNext = () => {
    setError('');
    if (!canProceed()) {
      const messages = [
        'Please select your faculty.',
        'Please enter your department or course of study.',
        'Please select your year of study.',
        'Please select at least one course.',
      ];
      setError(messages[step]);
      return;
    }
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 0) setStep(step - 1);
  };

  const toggleCourse = (courseId) => {
    setSelectedCourses(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      await completeOnboarding(
        userId,
        faculty,
        courseOfStudy.trim(),
        parseInt(yearOfStudy),
        selectedCourses,
      );

      await updateDoc(doc(db, 'users', userId), {
        faculty,
        course_of_study:     courseOfStudy.trim(),
        year_of_study:       parseInt(yearOfStudy),
        onboarding_complete: true,
        enrolled_courses:    selectedCourses,
        updated_at:          serverTimestamp(),
      });

      onComplete();
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Onboarding error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>AdaptiveTutor</Text>
        <Text style={styles.headerSub}>Let's set up your learning profile</Text>
        <StepIndicator
          currentStep={step}
          totalSteps={totalSteps}
          theme={theme}
        />
        <Text style={styles.stepLabel}>Step {step + 1} of {totalSteps}</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepTitle}>{steps[step].title}</Text>
        <Text style={styles.stepSubtitle}>{steps[step].subtitle}</Text>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Step 0: Faculty */}
        {step === 0 && FACULTIES.map(f => (
          <OptionButton
            key={f}
            label={f}
            selected={faculty === f}
            onPress={() => setFaculty(f)}
            theme={theme}
          />
        ))}

        {/* Step 1: Department (free text) */}
        {step === 1 && (
          <View>
            <TextInput
              style={[
                styles.textInput,
                courseOfStudy.trim() === '' && error
                  ? styles.textInputError
                  : null,
              ]}
              placeholder="e.g. Computer Science, Law, Nursing..."
              placeholderTextColor={theme.textSecondary}
              value={courseOfStudy}
              onChangeText={setCourseOfStudy}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
            <Text style={styles.inputHint}>
              Type your department exactly as it appears on your school records.
            </Text>

            {/* Show selected faculty as context */}
            {faculty !== '' && (
              <View style={styles.facultyPill}>
                <Text style={styles.facultyPillText}>
                  📚 {faculty}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Step 2: Year of Study */}
        {step === 2 && (
          <View style={styles.yearGrid}>
            {YEARS.map(y => (
              <TouchableOpacity
                key={y}
                style={[
                  styles.yearButton,
                  {
                    backgroundColor: yearOfStudy === y
                      ? Colors.primary : theme.surface,
                    borderColor: yearOfStudy === y
                      ? Colors.primary : theme.border,
                  },
                ]}
                onPress={() => setYearOfStudy(y)}
              >
                <Text style={[
                  styles.yearText,
                  { color: yearOfStudy === y ? '#fff' : theme.text },
                ]}>
                  Year {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 3: Course Selection */}
        {step === 3 && AVAILABLE_COURSES.map(course => (
          <CourseCard
            key={course.id}
            course={course}
            selected={selectedCourses.includes(course.id)}
            onPress={() => toggleCourse(course.id)}
            theme={theme}
          />
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {step === 0 ? (
          // On first step, back goes to auth screens
          <TouchableOpacity
            style={styles.backButton}
            onPress={async () => {
              try {
                const { signOut } = await import('firebase/auth');
                await signOut(auth);
              } catch (e) {
                console.log('Sign out error:', e);
              }
            }}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>← Sign In</Text>
          </TouchableOpacity>
        ) : (
          // On other steps, back goes to previous step
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
          ]}
          onPress={handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextButtonText}>
              {step === totalSteps - 1 ? 'Get Started →' : 'Next →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

    </View>
  );
}

function makeStyles(theme, isDark) {
  return StyleSheet.create({
    container: {
      flex:            1,
      backgroundColor: theme.background,
    },
    header: {
      backgroundColor:   theme.surface,
      paddingTop:        Platform.OS === 'ios' ? 56 : 40,
      paddingBottom:     20,
      paddingHorizontal: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    appName: {
      fontSize:     20,
      fontWeight:   'bold',
      color:        Colors.primary,
      marginBottom: 4,
    },
    headerSub: {
      fontSize:     13,
      color:        theme.textSecondary,
      marginBottom: 20,
    },
    stepLabel: {
      fontSize:  12,
      color:     theme.textSecondary,
      marginTop: 4,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 24,
    },
    stepTitle: {
      fontSize:     22,
      fontWeight:   'bold',
      color:        theme.text,
      marginBottom: 6,
    },
    stepSubtitle: {
      fontSize:     14,
      color:        theme.textSecondary,
      marginBottom: 24,
      lineHeight:   20,
    },
    errorBanner: {
      backgroundColor: '#FEE2E2',
      borderRadius:    8,
      padding:         12,
      marginBottom:    16,
      borderLeftWidth: 3,
      borderLeftColor: Colors.danger,
    },
    errorText: {
      color:    '#B91C1C',
      fontSize: 13,
    },
    textInput: {
      backgroundColor: theme.surface,
      borderWidth:     1.5,
      borderColor:     theme.border,
      borderRadius:    12,
      padding:         16,
      fontSize:        16,
      color:           theme.text,
      marginBottom:    8,
    },
    textInputError: {
      borderColor: Colors.danger,
    },
    inputHint: {
      fontSize:     12,
      color:        theme.textSecondary,
      marginBottom: 16,
      lineHeight:   18,
    },
    facultyPill: {
      backgroundColor: `${Colors.primary}15`,
      borderRadius:    8,
      padding:         12,
      borderWidth:     1,
      borderColor:     `${Colors.primary}40`,
    },
    facultyPillText: {
      color:      Colors.primary,
      fontSize:   13,
      fontWeight: '600',
    },
    yearGrid: {
      flexDirection: 'row',
      flexWrap:      'wrap',
      gap:           12,
    },
    yearButton: {
      width:        '45%',
      padding:      20,
      borderRadius: 12,
      borderWidth:  1.5,
      alignItems:   'center',
    },
    yearText: {
      fontSize:   16,
      fontWeight: 'bold',
    },
    footer: {
      flexDirection:    'row',
      padding:          20,
      gap:              12,
      backgroundColor:  theme.surface,
      borderTopWidth:   1,
      borderTopColor:   theme.border,
    },
    backButton: {
      flex:            1,
      padding:         16,
      borderRadius:    12,
      borderWidth:     1.5,
      borderColor:     theme.border,
      alignItems:      'center',
      backgroundColor: theme.background,
    },
    backButtonText: {
      color:      theme.text,
      fontWeight: '600',
      fontSize:   15,
    },
    nextButton: {
      flex:            2,
      padding:         16,
      borderRadius:    12,
      backgroundColor: Colors.primary,
      alignItems:      'center',
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    nextButtonText: {
      color:      '#fff',
      fontWeight: 'bold',
      fontSize:   15,
    },
  });
}