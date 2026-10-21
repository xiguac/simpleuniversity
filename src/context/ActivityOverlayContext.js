import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';

const ActivityOverlayContext = createContext(null);

/**
 * 活动详情打开入口的轻量包装：
 * 调用方屏幕点击卡片 → 跳转 ActivityDetail 路由页（栈内标准过渡动画）。
 * navigation 优先用调用方屏幕自身的 navigation（tab/stack 的 navigate 会自动 bubble 到根栈）；
 * container 层的 useNavigation 是 stub（dispatch 无效），只作 fallback。
 */
export function ActivityOverlayProvider({ children }) {
  const navigateRef = useRef(null);

  const setNavigatorHandler = useCallback((handler) => {
    navigateRef.current = handler;
  }, []);

  const openActivity = useCallback(
    (item, sourceLayout, variant = 'default', options = {}, navigation) => {
      const params = { activityId: item.id, previewItem: item };
      if (navigation) {
        navigation.navigate('ActivityDetail', params);
      } else {
        navigateRef.current?.('ActivityDetail', params);
      }
    },
    []
  );

  const value = useMemo(() => ({ openActivity, setNavigatorHandler }), [openActivity, setNavigatorHandler]);

  return <ActivityOverlayContext.Provider value={value}>{children}</ActivityOverlayContext.Provider>;
}

export function useActivityOverlay() {
  const context = useContext(ActivityOverlayContext);
  if (!context) {
    throw new Error('useActivityOverlay must be used within ActivityOverlayProvider');
  }
  return context;
}

// 放在 NavigationContainer 内部，把 navigation.push 注册给 openActivity 使用
export function ActivityNavigationBridge() {
  const navigation = useNavigation();
  const { setNavigatorHandler } = useActivityOverlay();

  useEffect(() => {
    setNavigatorHandler((route, params) => navigation.navigate(route, params));
    return () => setNavigatorHandler(null);
  }, [navigation, setNavigatorHandler]);

  return null;
}
