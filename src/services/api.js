import { auth } from './firebase';

// The backend address comes from EXPO_PUBLIC_API_URL (see .env.example).
// Expo inlines EXPO_PUBLIC_* variables into the bundle at build time, so this
// must be read as `process.env.EXPO_PUBLIC_API_URL` exactly. If it is not set
// (for example in an EAS build with no .env file), fall back to the deployed
// server so existing builds keep working.
const DEFAULT_API_URL = 'https://adaptive-tutor-api.onrender.com';
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');

// Every API request carries the signed-in user's Firebase ID token so the
// backend can verify who is calling. getIdToken() returns a cached token and
// only contacts Firebase when it is close to expiry; forceRefresh skips the
// cache.
async function buildHeaders(forceRefresh) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You are not signed in. Please sign in and try again.');
  }
  const token = await user.getIdToken(forceRefresh);
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function request(method, endpoint, body) {
  const send = async (forceRefresh) =>
    fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: await buildHeaders(forceRefresh),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await send(false);
  // A 401 may mean the cached token was revoked or expired early:
  // get a fresh one and try exactly once more.
  if (response.status === 401) {
    response = await send(true);
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Something went wrong');
  return data;
}

const post = (endpoint, body) => request('POST', endpoint, body);
const get  = (endpoint) => request('GET', endpoint);

export const completeOnboarding = (userId, faculty, courseOfStudy, yearOfStudy, selectedCourseIds) =>
  post('/onboarding/complete', { user_id: userId, faculty, course_of_study: courseOfStudy, year_of_study: yearOfStudy, selected_course_ids: selectedCourseIds });

export const fetchLesson = (userId, topicId) =>
  post('/lesson/fetch', { user_id: userId, topic_id: topicId });

export const fetchRemedialLesson = (userId, topicId, weakSubtopics) =>
  post('/lesson/remedial', { user_id: userId, topic_id: topicId, weak_subtopics: weakSubtopics });

export const getLessonHistory = (userId, topicId) =>
  get(`/lesson/history/${userId}/${topicId}`);

export const fetchQuiz = (userId, topicId, difficulty, sessionType = 'seeded') =>
  post('/quiz/fetch', { user_id: userId, topic_id: topicId, difficulty, session_type: sessionType });

export const submitQuiz = (sessionId, userId, topicId, difficulty, answers, timeTaken = 0) =>
  post('/quiz/submit', { session_id: sessionId, user_id: userId, topic_id: topicId, difficulty, answers, time_taken_seconds: timeTaken });

export const requestHint = (questionText, topic, difficulty) =>
  post('/quiz/hint', { question_text: questionText, topic, difficulty });

export const generatePersonalizedQuiz = (userId, topicId, difficulty, weakSubtopics) =>
  post('/quiz/generate-personalized', { user_id: userId, topic_id: topicId, difficulty, weak_subtopics: weakSubtopics });

export const sendChatMessage = async (userId, message, topicContext, history, sessionId = null) => {
  const response = await post('/chat/message', {
    user_id:       userId,
    message:       message,
    topic_context: topicContext || null,
    history:       history || [],
    session_id:    sessionId || null,
  });
  return response;
  // response now includes: { response, message_id, session_id }
};

export const getChatSessions = async (userId) => {
  const response = await get(`/chat/sessions/${userId}`);
  return response;
};

export const createChatSession = async (userId) => {
  const response = await post(`/chat/sessions/${userId}`, {});
  return response;
};

export const getChatHistory = async (userId, sessionId = null) => {
  const url = sessionId
    ? `/chat/history/${userId}?session_id=${sessionId}`
    : `/chat/history/${userId}`;
  const response = await get(url);
  return response;
};

export const getLearningState = (userId, courseId) =>
  get(`/progress/learning-state/${userId}/${courseId}`);

export const getFullProgress = (userId) =>
  get(`/progress/${userId}`);

export const updateStreak = (userId) =>
  post('/progress/streak/update', { user_id: userId });

export const initCourse = (userId, courseId) =>
  post('/adaptive/init-course', { user_id: userId, course_id: courseId });

// /health is public and is called as soon as auth state changes, so it does
// not go through request() and sends no token.
export const warmupBackend = async () => {
  try {
    await fetch(`${BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    // Silently ignore — warmup is best effort
  }
};