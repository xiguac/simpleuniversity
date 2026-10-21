import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, ToastAndroid, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import QRScreen from './src/screens/QRScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TribeListScreen from './src/screens/TribeListScreen';
import TribeDetailScreen from './src/screens/TribeDetailScreen';
import ActivityDetailScreen from './src/screens/ActivityDetailScreen';
import MyActivitiesScreen from './src/screens/MyActivitiesScreen';
import LiquidGlassTabBar from './src/LiquidGlassTabBarV2';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ActivityOverlayProvider, ActivityNavigationBridge } from './src/context/ActivityOverlayContext';

const Tab = createBottomTabNavigator();
// native-stack：页面切换和手势由原生（react-native-screens）驱动，
// 动画不占 JS 线程，列表再重过渡也不会掉帧
const Stack = createNativeStackNavigator();

// Android 返回键统一处理：
// 1. 导航栈内有页面 → 正常返回
// 2. 已到根部 → 第一次提示，2 秒内再按才退出
function BackHandlerBridge({ navigationRef }) {
  const lastBackPressRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return undefined;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigationRef.current?.canGoBack()) {
        return false;
      }
      const now = Date.now();
      if (now - lastBackPressRef.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressRef.current = now;
      ToastAndroid.show('再按一次退出', ToastAndroid.SHORT);
      return true;
    });
    return () => sub.remove();
  }, [navigationRef]);

  return null;
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <LiquidGlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0f8f58',
        tabBarInactiveTintColor: '#73848d',
      }}
    >
      <Tab.Screen
        name="活动"
        component={ActivityScreen}
        options={{
          title: '活动',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="身份码"
        component={QRScreen}
        options={{
          title: '身份码',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="我的"
        component={ProfileScreen}
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

// iOS 26 Liquid Glass 头部背景：内容从半透明玻璃下穿过；
// 低版本 iOS / Android 自动退回纯色，双端视觉统一。
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 把真实调用栈打到 Metro 日志，方便定位红屏问题
    console.error('BOUNDARY_MSG', String(error && error.message));
    console.error('BOUNDARY_STACK', String(error && error.stack).split('\n').slice(0, 15).join(' | '));
    console.error('BOUNDARY_COMP', String(error && error.componentStack || (info && info.componentStack)).split('\n').slice(0, 12).join(' | '));
  }

  render() {
    if (this.state.error) {
      return <View style={{ flex: 1 }} />;
    }
    return this.props.children;
  }
}

function LiquidGlassHeaderBackground() {
  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        style={StyleSheet.absoluteFill}
        glassEffectStyle="regular"
        tintColor="rgba(244,247,246,0.82)"
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#f4f7f6ee' }]} />;
}

function AppShell() {
  const { isLoggedIn, setIsLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user_data');
        if (savedUser) {
          setIsLoggedIn(true);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [setIsLoggedIn]);

  const handleLogin = async (loginResponse) => {
    try {
      const { oauth_token, oauth_token_secret } = loginResponse.oldUserInfo;
      const profileUrl =
        `https://pocketuni.net/index.php?app=api&mod=User&act=selfhome&oauth_token=${oauth_token}&oauth_token_secret=${oauth_token_secret}`;
      const profileRes = await fetch(profileUrl);
      const profileText = await profileRes.text();
      const profileData = JSON.parse(profileText);
      const fullUserData = { ...loginResponse, fullProfile: profileData };
      await AsyncStorage.setItem('user_data', JSON.stringify(fullUserData));
      setIsLoggedIn(true);
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2ecc71" />
      </View>
    );
  }

  return (
    <ActivityOverlayProvider>
      <BackHandlerBridge navigationRef={navigationRef} />
      <NavigationContainer ref={navigationRef}>
        <ActivityNavigationBridge />
        {isLoggedIn ? (
          <Stack.Navigator
            screenOptions={{
              headerTintColor: '#20323a',
              headerBackTitle: '返回',
              headerShadowVisible: false,
              headerTransparent: true,
              headerBackground: () => <LiquidGlassHeaderBackground />,
              gestureEnabled: true,
              contentStyle: { backgroundColor: '#f4f7f6' },
              // native-stack 原生水平滑入（等效原 forHorizontalIOS 的观感）
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false, title: '返回' }} />
            <Stack.Screen name="MyActivities" component={MyActivitiesScreen} options={{ title: '我的活动' }} />
            <Stack.Screen name="TribeList" component={TribeListScreen} options={{ title: '我的部落' }} />
            <Stack.Screen name="TribeDetail" component={TribeDetailScreen} options={{ title: '部落详情' }} />
            <Stack.Screen name="ActivityDetail" component={ActivityDetailScreen} options={{ title: '活动详情' }} />
          </Stack.Navigator>
        ) : (
          <LoginScreen onLogin={handleLogin} />
        )}
      </NavigationContainer>
    </ActivityOverlayProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <GlobalErrorBoundary>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </GlobalErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f7f6',
  },
});

