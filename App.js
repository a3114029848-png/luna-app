import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { loadAll, setCloudSyncHooks } from './src/services/periodStore';
import { saveRecord, getRecords } from './src/services/api';
import { getDeviceUserId } from './src/services/userStore';

export default function App() {
  useEffect(() => {
    // 设备级匿名 userId：每台设备独立（数据隔离），不采集身份信息
    (async () => {
      const userId = await getDeviceUserId();
      // 云同步钩子：保存后上报后端，启动时拉取合并（后端不可用时静默降级为本地）
      setCloudSyncHooks({
        onSaved: async (record) => {
          await saveRecord({ userId, record });
        },
        onLoad: async () => {
          const res = await getRecords(userId);
          return res.records || {};
        },
      });
      // 数据持久化闭环：启动时把本地记录加载进内存（刷新不丢）
      await loadAll();
    })();
  }, []);

  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ThemeProvider>
  );
}
