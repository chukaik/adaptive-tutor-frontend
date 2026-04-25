const BASE_URL = 'https://adaptive-tutor-api.onrender.com';

const headers = { 'Content-Type': 'application/json' };

async function post(endpoint, body) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST', headers, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Something went wrong');
  return data;
}

async function get(endpoint) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET', headers,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Something went wrong');
  return data;
}

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