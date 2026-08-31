import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { loadAll, setCloudSyncHooks } from './src/services/periodStore';
import { saveRecord, getRecords } from './src/services/api';

// Demo 用固定 userId（真实产品应有账号体系 / 鉴权）
const DEMO_USER_ID = 'luna-demo-user';

export default function App() {
  useEffect(() => {
    // 云同步钩子：保存后上报后端，启动时拉取合并（后端不可用时静默降级为本地）
    setCloudSyncHooks({
      onSaved: async (record) => {
        await saveRecord({ userId: DEMO_USER_ID, record });
      },
      onLoad: async () => {
        const res = await getRecords(DEMO_USER_ID);
        return res.records || {};
      },
    });
    // 数据持久化闭环：启动时把本地记录加载进内存（刷新不丢）
    loadAll();
  }, []);

  return (
    <ThemeProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </ThemeProvider>
  );
}
