import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const THEME_PRESETS = [
  { id: 'green',  label: '医疗绿', primary: '#1a6b5a', light: '#e1f5ee', mid: '#c8e0d8' },
  { id: 'blue',   label: '天空蓝', primary: '#457b9d', light: '#e6f1fb', mid: '#b5d4f4' },
  { id: 'purple', label: '薰衣草', primary: '#7f77dd', light: '#eeedfe', mid: '#cecbf6' },
  { id: 'rose',   label: '玫瑰红', primary: '#d4537e', light: '#fbeaf0', mid: '#f4c0d1' },
  { id: 'amber',  label: '暖橙',   primary: '#ba7517', light: '#faeeda', mid: '#fac775' },
];

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(THEME_PRESETS[0]);

  useEffect(() => {
    AsyncStorage.getItem('luna_theme').then(id => {
      if (id) {
        const found = THEME_PRESETS.find(t => t.id === id);
        if (found) setTheme(found);
      }
    });
  }, []);

  const changeTheme = async (preset) => {
    setTheme(preset);
    await AsyncStorage.setItem('luna_theme', preset.id);
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme, presets: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
