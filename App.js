import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, ToastAndroid, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CardStyleInterpolators, createStackNavigator, TransitionSpecs } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
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
const Stack = createStackNavigator();

// Android 返回键统一处理：
// 1. 导航栈内有页面 → 正常返回
// 2. 已到根部 → 第一次提示，2 秒内再按才退出
function BackHandlerBridge({ navigationRef }) {
  const lastBackPressRef = useRef(0);

  useEffect(() => {
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
              headerBackTitleVisible: true,
              headerBackTitle: '返回',
              headerShadowVisible: false,
              gestureEnabled: true,
              cardStyle: { backgroundColor: '#f4f7f6' },
            }}
          >
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false, title: '返回' }} />
            <Stack.Screen name="MyActivities" component={MyActivitiesScreen} options={{ title: '我的活动' }} />
            <Stack.Screen name="TribeList" component={TribeListScreen} options={{ title: '我的部落' }} />
            <Stack.Screen
              name="TribeDetail"
              component={TribeDetailScreen}
              options={{
                title: '部落详情',
                animationEnabled: true,
                gestureDirection: 'horizontal',
                cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                transitionSpec: {
                  open: TransitionSpecs.TransitionIOSSpec,
                  close: TransitionSpecs.TransitionIOSSpec,
                },
              }}
            />
            <Stack.Screen
              name="ActivityDetail"
              component={ActivityDetailScreen}
              options={{
                title: '活动详情',
                gestureEnabled: true,
                cardStyle: { backgroundColor: '#f4f7f6' },
                // 普通过渡动画：水平滑入（与部落详情一致）
                animationEnabled: true,
                gestureDirection: 'horizontal',
                cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
                transitionSpec: {
                  open: TransitionSpecs.TransitionIOSSpec,
                  close: TransitionSpecs.TransitionIOSSpec,
                },
              }}
            />
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
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

