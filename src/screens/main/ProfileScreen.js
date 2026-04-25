import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../../services/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { signOut, updateProfile } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../../constants/ThemeContext';
import { Colors } from '../../constants/colors';

// ─── Cloudinary Config ───────────────────────────────────────────────────────

const CLOUDINARY_CLOUD_NAME = 'dick1btdu';
const CLOUDINARY_UPLOAD_PRESET = 'adaptiveTutor';

const uploadToCloudinary = async (imageUri) => {
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  if (Platform.OS === 'web') {
    // On web: fetch the URI as blob then upload
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append('file', blob, 'profile.jpg');
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData });
    const data = await uploadResponse.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
  } else {
    // On native (Android/iOS): use URI directly
    const formData = new FormData();
    formData.append('file', { uri: imageUri, type: 'image/jpeg', name: 'profile.jpg' });
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData });
    const data = await uploadResponse.json();
    if (data.error) throw new Error(data.error.message);
    return data.secure_url;
  }
};

// ─── Available Courses ────────────────────────────────────────────────────────

const AVAILABLE_COURSES = [
  { id: 'TEbLVrd24pWd27qXnbnC', code: 'COS201', title: 'Computer Programming I' },
  { id: 'QhVX2kifeGLeN9Q1uJA7', code: 'CSC301', title: 'Data Structures' },
];

// ─── Badge Data ──────────────────────────────────────────────────────────────

const ALL_BADGES = [
  { id: 'first_step',        emoji: '🎯', name: 'First Step' },
  { id: 'quiz_debut',        emoji: '📝', name: 'Quiz Debut' },
  { id: 'first_win',         emoji: '✅', name: 'First Win' },
  { id: 'perfect_score',     emoji: '💯', name: 'Perfect Score' },
  { id: 'speed_learner',     emoji: '⚡', name: 'Speed Learner' },
  { id: 'speed_pro',         emoji: '🏎️', name: 'Speed Pro' },
  { id: 'perfect_score_x2',  emoji: '🌠', name: 'Perfect Score X2' },
  { id: 'topic_explorer',    emoji: '🔓', name: 'Topic Explorer' },
  { id: 'halfway_there',     emoji: '🏃', name: 'Halfway There' },
  { id: 'topic_master',      emoji: '🏆', name: 'Topic Master' },
  { id: 'course_champion',   emoji: '🎓', name: 'Course Champion' },
  { id: 'streak_starter',    emoji: '🔥', name: 'Streak Starter' },
  { id: 'dedicated_learner', emoji: '💪', name: 'Dedicated Learner' },
  { id: 'unstoppable',       emoji: '🚀', name: 'Unstoppable' },
  { id: 'invincible',        emoji: '👑', name: 'Invincible' },
  { id: 'never_give_up',     emoji: '💎', name: 'Never Give Up' },
  { id: 'comeback_kid',      emoji: '🌟', name: 'Comeback Kid' },
  { id: 'curious_mind',      emoji: '🤔', name: 'Curious Mind' },
  { id: 'hint_seeker',       emoji: '💡', name: 'Hint Seeker' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatJoinedDate = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const InfoRow = ({ icon, label, value, isLast, theme }) => (
  <View
    style={[
      styles.infoRow,
      !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
    ]}
  >
    <View style={styles.infoRowLeft}>
      <Ionicons name={icon} size={18} color={Colors.primary} style={styles.infoIcon} />
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
    </View>
    <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={1}>
      {value || '—'}
    </Text>
  </View>
);

const SettingRow = ({ icon, label, right, isLast, theme }) => (
  <View
    style={[
      styles.settingRow,
      !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
    ]}
  >
    <View style={styles.settingRowLeft}>
      <Ionicons name={icon} size={20} color={theme.textSecondary} style={styles.settingIcon} />
      <Text style={[styles.settingLabel, { color: theme.text }]}>{label}</Text>
    </View>
    {right}
  </View>
);

// ─── Badge Computation ────────────────────────────────────────────────────────

const computeEarnedBadgesSync = (
  userDataObj,
  fetchedProgressDocs,
  fetchedSessions,
  hasChatHistory = false
) => {
  const earned = new Set();
  const streak = userDataObj?.login_streak || 0;

  const passedSessions  = fetchedSessions.filter(s => s.passed === true);
  const perfectSessions = fetchedSessions.filter(s => s.score === 100);
  const speedSessions   = fetchedSessions.filter(s => s.passed && (s.time_taken_seconds || 999) < 180);
  const failedTopicIds  = new Set(fetchedSessions.filter(s => !s.passed).map(s => s.topic_id));

  if (fetchedProgressDocs.some(p =>
    p.mastery_level === 'high' ||
    p.difficulty_unlocked === 'completed' ||
    (p.attempts || 0) > 0
  )) earned.add('first_step');

  if (fetchedSessions.length > 0)    earned.add('quiz_debut');
  if (passedSessions.length > 0)     earned.add('first_win');
  if (perfectSessions.length >= 1)   earned.add('perfect_score');
  if (perfectSessions.length >= 3)   earned.add('perfect_score_x2');
  if (speedSessions.length >= 1)     earned.add('speed_learner');
  if (speedSessions.length >= 3)     earned.add('speed_pro');

  const hardQuizPassed = fetchedSessions.some(
    s => s.passed === true &&
    (s.difficulty === 'hard' || s.difficulty === 'completed')
  );
  if (hardQuizPassed) earned.add('topic_explorer');

  const masteredTopics  = fetchedProgressDocs.filter(p =>
    p.mastery_level === 'high' || p.difficulty_unlocked === 'completed'
  );
  if (masteredTopics.length >= 1)    earned.add('topic_master');

  const cos201Progress = fetchedProgressDocs.filter(p => p.course_id === 'TEbLVrd24pWd27qXnbnC');
  const csc301Progress = fetchedProgressDocs.filter(p => p.course_id === 'QhVX2kifeGLeN9Q1uJA7');
  [cos201Progress, csc301Progress].forEach(courseProgress => {
    if (courseProgress.length === 0) return;
    const mastered = courseProgress.filter(p =>
      p.mastery_level === 'high' || p.difficulty_unlocked === 'completed'
    ).length;
    if (mastered >= Math.ceil(courseProgress.length / 2)) earned.add('halfway_there');
    if (mastered === courseProgress.length)               earned.add('course_champion');
  });

  if (streak >= 3)  earned.add('streak_starter');
  if (streak >= 7)  earned.add('dedicated_learner');
  if (streak >= 14) earned.add('unstoppable');
  if (streak >= 30) earned.add('invincible');

  const retriedAndPassed = fetchedSessions.some(s => s.passed && failedTopicIds.has(s.topic_id));
  if (retriedAndPassed) earned.add('never_give_up');

  const topicScores = {};
  fetchedSessions.forEach(s => {
    if (!topicScores[s.topic_id]) topicScores[s.topic_id] = [];
    topicScores[s.topic_id].push(s.score);
  });
  Object.values(topicScores).forEach(scores => {
    if (scores.some(s => s < 80) && scores.some(s => s >= 80)) earned.add('comeback_kid');
  });

  if (fetchedSessions.length > 0)    earned.add('hint_seeker');
  if (hasChatHistory) earned.add('curious_mind');

  return earned;
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { theme, isDark, toggleTheme } = useTheme();

  const [userData,       setUserData]       = useState(null);
  const [isEditing,      setIsEditing]      = useState(false);
  const [editName,       setEditName]       = useState('');
  const [editBio,        setEditBio]        = useState('');
  const [editLinkedIn,   setEditLinkedIn]   = useState('');
  const [earnedBadges,   setEarnedBadges]   = useState(new Set());
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [progressDocs,   setProgressDocs]   = useState([]);
  const [quizSessions,   setQuizSessions]   = useState([]);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState([]);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshAll = async () => {
        try {
          const currentUser = auth.currentUser;
          if (!currentUser) return;
          const userId = currentUser.uid;

          const [userSnap, progressSnap, sessionsSnap] =
            await Promise.all([
              getDoc(doc(db, 'users', userId)),
              getDocs(query(
                collection(db, 'student_progress'),
                where('user_id', '==', userId)
              )),
              getDocs(query(
                collection(db, 'quiz_sessions'),
                where('user_id', '==', userId)
              )),
            ]);

          if (!active) return;

          const freshUserData = userSnap.exists()
            ? userSnap.data() : null;
          const freshProgressDocs = progressSnap.docs
            .map(d => d.data());
          const freshSessions = sessionsSnap.docs
            .map(d => d.data());

          let hasChatHistory = false;
          try {
            const sessionsRef = collection(
              db, 'chat_history', userId, 'sessions'
            );
            const chatSnap = await getDocs(
              query(sessionsRef, limit(1))
            );
            hasChatHistory = !chatSnap.empty;
          } catch (e) {
            hasChatHistory = false;
          }

          if (freshUserData) setUserData(freshUserData);
          setEnrolledCourseIds(freshUserData?.enrolled_courses || []);
          setProgressDocs(freshProgressDocs);
          setQuizSessions(freshSessions);

          const earned = computeEarnedBadgesSync(
            freshUserData,
            freshProgressDocs,
            freshSessions,
            hasChatHistory
          );
          setEarnedBadges(earned);

          if (!isEditing) {
            setEditName(freshUserData?.name || '');
            setEditBio(freshUserData?.bio || '');
            setEditLinkedIn(freshUserData?.linkedin_url || '');
          }

        } catch (e) {
          console.log('Profile refresh error:', e);
        } finally {
          setLoading(false);
        }
      };

      refreshAll();
      return () => { active = false; };
    }, [])
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setUploadingPhoto(true);
      try {
        const url = await uploadToCloudinary(result.assets[0].uri);
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          profile_picture_url: url,
        });
        await updateProfile(auth.currentUser, { photoURL: url });
        setUserData(prev => ({ ...prev, profile_picture_url: url }));
        Alert.alert('Success', 'Profile picture updated!');
      } catch (e) {
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const userId = auth.currentUser?.uid;
      await updateDoc(doc(db, 'users', userId), {
        name:         editName.trim(),
        bio:          editBio.trim(),
        linkedin_url: editLinkedIn.trim(),
        updated_at:   serverTimestamp(),
      });
      await updateProfile(auth.currentUser, { displayName: editName.trim() });
      setUserData(prev => ({
        ...prev,
        name:         editName.trim(),
        bio:          editBio.trim(),
        linkedin_url: editLinkedIn.trim(),
      }));
      setIsEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCourse = async (courseId) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const newEnrolled = [
        ...enrolledCourseIds,
        courseId,
      ];

      await updateDoc(doc(db, 'users', userId), {
        enrolled_courses: newEnrolled,
        updated_at: serverTimestamp(),
      });

      setEnrolledCourseIds(newEnrolled);

      try {
        const API_BASE_URL =
          'https://adaptive-tutor-api.onrender.com';

        await fetch(
          `${API_BASE_URL}/adaptive/init-course`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: userId,
              course_id: courseId,
            }),
          }
        );
      } catch (initError) {
        console.log('Course init error:', initError);
      }

      Alert.alert(
        'Course Added',
        'You have been enrolled. Visit the ' +
        'Learn tab to start your first lesson.'
      );

    } catch (e) {
      Alert.alert('Error', 'Failed to add course.');
    }
  };

  const handleCancelEdit = () => {
    setEditName(userData?.name || '');
    setEditBio(userData?.bio || '');
    setEditLinkedIn(userData?.linkedin_url || '');
    setIsEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (e) {
              Alert.alert('Error', 'Failed to sign out.');
            }
          },
        },
      ]
    );
  };

  // ── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Derived Values ─────────────────────────────────────────────────────────

  const joinedDateStr  = userData?.joined_date ? formatJoinedDate(userData.joined_date) : null;
  const nameInitial    = (userData?.name || auth.currentUser?.displayName || '?')[0].toUpperCase();
  const profilePicUrl  = userData?.profile_picture_url;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>

      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
        <View style={styles.headerActions}>
          {isEditing ? (
            <>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.headerBtn}>
                <Text style={[styles.headerBtnText, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={saving}>
                {saving
                  ? <ActivityIndicator size="small" color={Colors.primary} />
                  : <Text style={[styles.headerBtnText, { color: Colors.primary }]}>Save</Text>
                }
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.headerBtn}>
              <Text style={[styles.headerBtnText, { color: Colors.primary }]}>Edit Profile</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Profile Hero ── */}
        <View style={[styles.heroSection, { backgroundColor: theme.surface }]}>
          <TouchableOpacity onPress={handlePickImage} activeOpacity={0.85} style={styles.avatarWrapper}>
            {profilePicUrl ? (
              <Image source={{ uri: profilePicUrl }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarInitials, { backgroundColor: Colors.primary }]}>
                <Text style={styles.avatarInitialsText}>{nameInitial}</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.avatarOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={[styles.heroName, { color: theme.text }]}>
            {userData?.name || auth.currentUser?.displayName || 'Student'}
          </Text>
          <Text style={[styles.heroEmail, { color: theme.textSecondary }]}>
            {auth.currentUser?.email}
          </Text>
          {joinedDateStr && (
            <Text style={[styles.heroJoined, { color: theme.textSecondary }]}>
              Member since {joinedDateStr}
            </Text>
          )}
        </View>

        {/* ── Edit Mode Section ── */}
        {isEditing && (
          <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 16 }]}>
            <Text style={[styles.sectionLabel, { color: Colors.primary }]}>EDIT YOUR PROFILE</Text>

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Full Name *</Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Your full name"
              placeholderTextColor={theme.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Bio</Text>
            <TextInput
              style={[
                styles.input,
                styles.inputMultiline,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell us a bit about yourself..."
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>LinkedIn URL</Text>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              value={editLinkedIn}
              onChangeText={setEditLinkedIn}
              placeholder="https://linkedin.com/in/yourname"
              placeholderTextColor={theme.textSecondary}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        )}

        {/* ── Badges Section ── */}
        <View style={styles.badgesSection}>
          <View style={styles.badgesHeader}>
            <Text style={[styles.badgesTitle, { color: theme.text }]}>Badges Earned</Text>
            <View style={[styles.badgeCountPill, { backgroundColor: Colors.primary }]}>
              <Text style={styles.badgeCountText}>{earnedBadges.size}</Text>
            </View>
          </View>

          {earnedBadges.size > 0 ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.badgesScroll}
              >
                {ALL_BADGES.filter(b => earnedBadges.has(b.id)).map(badge => (
                  <View key={badge.id} style={[styles.badgeCard, { backgroundColor: theme.surface }]}>
                    <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                    <Text
                      style={[styles.badgeName, { color: Colors.primary }]}
                      numberOfLines={1}
                    >
                      {badge.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={[styles.badgesNote, { color: theme.textSecondary }]}>
                See full badge list in Progress → Badges tab
              </Text>
            </>
          ) : (
            <Text style={[styles.badgesEmpty, { color: theme.textSecondary }]}>
              Complete lessons and quizzes to earn badges!
            </Text>
          )}
        </View>

        {/* ── Profile Info Section ── */}
        <View style={[styles.card, { backgroundColor: theme.surface, marginTop: 16 }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>YOUR INFORMATION</Text>
          <InfoRow
            icon="school-outline"
            label="Faculty"
            value={userData?.faculty}
            isLast={false}
            theme={theme}
          />
          <InfoRow
            icon="book-outline"
            label="Course of Study"
            value={userData?.course_of_study}
            isLast={false}
            theme={theme}
          />
          <InfoRow
            icon="calendar-outline"
            label="Year of Study"
            value={userData?.year_of_study ? `Year ${userData.year_of_study}` : null}
            isLast={false}
            theme={theme}
          />
          <InfoRow
            icon="mail-outline"
            label="Email"
            value={auth.currentUser?.email}
            isLast={true}
            theme={theme}
          />
        </View>

        {/* ── Enrolled Courses Section ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            ENROLLED COURSES
          </Text>

          {AVAILABLE_COURSES.map((course, index) => {
            const isEnrolled = enrolledCourseIds.includes(course.id);
            return (
              <View
                key={course.id}
                style={[
                  styles.infoRow,
                  index < AVAILABLE_COURSES.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.infoRowLeft}>
                  <View style={{
                    backgroundColor: isEnrolled ? Colors.primary : theme.border,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    marginRight: 10,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                      {course.code}
                    </Text>
                  </View>
                  <Text style={[styles.infoLabel, { color: theme.text }]} numberOfLines={1}>
                    {course.title}
                  </Text>
                </View>

                {isEnrolled ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                    <Text style={{ color: Colors.success, fontSize: 12, fontWeight: '600' }}>
                      Enrolled
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => handleAddCourse(course.id)}
                    style={{
                      backgroundColor: Colors.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                      + Add
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* ── About Section ── */}
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>ABOUT</Text>

          {userData?.bio ? (
            <Text style={[styles.bioText, { color: theme.text }]}>{userData.bio}</Text>
          ) : (
            <Text style={[styles.bioEmpty, { color: theme.textSecondary }]}>No bio added yet.</Text>
          )}

          {!!userData?.linkedin_url && (
            <TouchableOpacity
              style={styles.linkedinRow}
              onPress={() => Linking.openURL(userData.linkedin_url)}
              activeOpacity={0.7}
            >
              <Ionicons name="globe-outline" size={16} color={Colors.primary} />
              <Text
                style={{ color: Colors.primary, fontSize: 13 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {userData.linkedin_url}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Settings Section ── */}
        <Text style={[styles.sectionLabelStandalone, { color: theme.textSecondary }]}>SETTINGS</Text>
        <View style={[styles.card, styles.cardNoPadding, { backgroundColor: theme.surface }]}>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            isLast={false}
            theme={theme}
            right={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.border, true: Colors.primary }}
                thumbColor={isDark ? Colors.primaryLight : '#fff'}
              />
            }
          />
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            isLast={true}
            theme={theme}
            right={
              <Text style={[styles.settingValue, { color: theme.textSecondary }]}>1.0.0</Text>
            }
          />
        </View>

        {/* ── Sign Out Button ── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        {/* ── Bottom Spacing ── */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  headerBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Scroll
  scrollContent: {
    paddingBottom: 8,
  },

  // ── Hero
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    marginBottom: 14,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarInitials: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialsText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 45,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  heroName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 13,
    marginBottom: 4,
  },
  heroJoined: {
    fontSize: 12,
    marginTop: 2,
  },

  // ── Card
  card: {
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  cardNoPadding: {
    padding: 0,
    overflow: 'hidden',
  },

  // ── Section labels
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionLabelStandalone: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },

  // ── Edit fields
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 10,
  },

  // ── Info rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  infoIcon: {
    marginRight: 10,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: '50%',
    textAlign: 'right',
  },

  // ── About
  bioText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  bioEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  linkedinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  linkedinText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Badges
  badgesSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  badgesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  badgesTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  badgeCountPill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  badgesScroll: {
    paddingRight: 8,
  },
  badgeCard: {
    width: 72,
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
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
  badgeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  badgesNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
  },
  badgesEmpty: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },

  // ── Settings
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingValue: {
    fontSize: 14,
  },

  // ── Sign Out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 16,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
