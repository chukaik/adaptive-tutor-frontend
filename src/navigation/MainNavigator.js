import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../constants/ThemeContext';
import { auth } from '../services/firebase';

import HomeScreen from '../screens/main/HomeScreen';
import LearnScreen from '../screens/main/LearnScreen';
import ProgressScreen from '../screens/main/ProgressScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import CourseScreen from '../screens/course/CourseScreen';
import TopicScreen from '../screens/course/TopicScreen';
import QuizScreen from '../screens/quiz/QuizScreen';
import QuizResultScreen from '../screens/quiz/QuizResultScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const PRIMARY = '#157C8E';
const ACCENT = '#E8A020';
const INACTIVE = '#9CA3AF';

function TabsNavigator({ navigation }) {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: 65,
            paddingBottom: 8,
            paddingTop: 0,
          },
          tabBarActiveTintColor: PRIMARY,
          tabBarInactiveTintColor: INACTIVE,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: 'bold',
          },
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Learn') {
              iconName = focused ? 'library' : 'library-outline';
            } else if (route.name === 'Progress') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
            } else if (route.name === 'Profile') {
              iconName = focused ? 'person' : 'person-outline';
            }
            return <Ionicons name={iconName} size={24} color={color} />;
          },
          tabBarButton: (props) => {
            const { children, onPress, accessibilityState } = props;
            const focused = accessibilityState?.selected;
            return (
              <TouchableOpacity
                onPress={onPress}
                style={[
                  styles.tabButton,
                  focused && styles.tabButtonActive,
                ]}
                activeOpacity={0.7}
              >
                {children}
              </TouchableOpacity>
            );
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Learn" component={LearnScreen} />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('Chat', { userId: auth.currentUser?.uid })}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="CourseScreen" component={CourseScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TopicScreen" component={TopicScreen} options={{ headerShown: false }} />
      <Stack.Screen name="QuizScreen" component={QuizScreen} options={{ headerShown: false }} />
      <Stack.Screen name="QuizResultScreen" component={QuizResultScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 3,
    borderTopWidth: 3,
    borderTopColor: 'transparent',
  },
  tabButtonActive: {
    borderTopColor: PRIMARY,
  },
  fab: {
    position: 'absolute',
    bottom: 85,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
