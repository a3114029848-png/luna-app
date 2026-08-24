import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

import HomeScreen        from '../screens/HomeScreen';
import CalendarScreen    from '../screens/CalendarScreen';
import ObservationScreen from '../screens/ObservationScreen';
import AIScreen          from '../screens/AIScreen';
import ProfileScreen     from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Tabler icon unicode 映射（使用文字符号替代，实际项目可换 react-native-vector-icons）
const TAB_CONFIG = [
  { name: '今日',  component: HomeScreen,        icon: '⊙' },
  { name: '日历',  component: CalendarScreen,    icon: '▦' },
  { name: '观察',  component: ObservationScreen, icon: '⟋' },
  { name: 'AI',    component: AIScreen,          icon: '✦' },
  { name: '我的',  component: ProfileScreen,     icon: '◎' },
];

export default function AppNavigator() {
  const { theme } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor:   theme.primary,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.label,
        tabBarIcon: ({ focused }) => {
          const cfg = TAB_CONFIG.find(t => t.name === route.name);
          return (
            <Text style={{ fontSize: 18, color: focused ? theme.primary : '#999' }}>
              {cfg?.icon}
            </Text>
          );
        },
      })}
    >
      {TAB_CONFIG.map(({ name, component }) => (
        <Tab.Screen key={name} name={name} component={component} />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor:  '#e0ede8',
    borderTopWidth:  0.5,
    height:          80,
    paddingBottom:   16,
    paddingTop:      8,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
