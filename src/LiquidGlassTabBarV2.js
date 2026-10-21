import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 严格按官方 expo-glass-effect 文档实现（docs.expo.dev/versions/v57.0.0/sdk/glass-effect/）：
// 1. 多个玻璃元素必须放进 GlassContainer，spacing 控制它们"聚合"成一个整体液态玻璃
// 2. 选中态切换用 glassEffectStyle={{ style, animate: true, animationDuration }} 的
//    原生形变动画（'clear' ↔ 'none'），这是官方文档推荐的、不经 opacity 的动画方式
// 3. 每个可点元素 isInteractive，获得系统液态玻璃的按压反馈
// 4. 低版本 iOS / Android 回退为纯 View 实现，视觉逻辑一致
const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

const INDICATOR = {
  active: { style: 'clear', animate: true, animationDuration: 0.35 },
  inactive: { style: 'none', animate: true, animationDuration: 0.35 },
};

export default function LiquidGlassTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const isCenter = (index) => state.routes.length > 1 && index === Math.floor(state.routes.length / 2);
  const iconColor = (focused) => (focused ? styles.focusText.color : styles.blurText.color);

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {nativeGlass ? (
        // 官方模式：GlassContainer 把每块玻璃合成一个整体
        <GlassContainer spacing={6} style={styles.container}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const { options } = descriptors[route.key];
            const rawLabel = options.tabBarLabel ?? options.title ?? route.name;
            const label = typeof rawLabel === 'string' ? rawLabel : route.name;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <GlassView
                key={route.key}
                isInteractive={true}
                colorScheme="light"
                glassEffectStyle={isFocused ? INDICATOR.active : INDICATOR.inactive}
                style={styles.item}
              >
                <Pressable onPress={onPress} style={styles.itemInner}>
                  <View style={styles.tabInner}>
                    {options.tabBarIcon
                      ? options.tabBarIcon({ focused: isFocused, color: iconColor(isFocused), size: isCenter(index) ? 26 : 22 })
                      : <Ionicons name="ellipse-outline" size={22} color={iconColor(isFocused)} />}
                    <Text style={[styles.tabLabel, isFocused ? styles.focusText : styles.blurText]}>{label}</Text>
                  </View>
                </Pressable>
              </GlassView>
            );
          })}
        </GlassContainer>
      ) : (
        // 回退：纯色轨道 + 半透明选中块
        <View style={styles.container}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const { options } = descriptors[route.key];
            const rawLabel = options.tabBarLabel ?? options.title ?? route.name;
            const label = typeof rawLabel === 'string' ? rawLabel : route.name;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <View key={route.key} style={[styles.item, isFocused && styles.fallbackItem]}>
                <Pressable onPress={onPress} style={styles.itemInner}>
                  <View style={styles.tabInner}>
                    {options.tabBarIcon
                      ? options.tabBarIcon({ focused: isFocused, color: iconColor(isFocused), size: isCenter(index) ? 26 : 22 })
                      : <Ionicons name="ellipse-outline" size={22} color={iconColor(isFocused)} />}
                    <Text style={[styles.tabLabel, isFocused ? styles.focusText : styles.blurText]}>{label}</Text>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  // 玻璃版本：容器只负责布局，液态外观来自聚合的子 GlassView
  // 非玻璃版本：容器提供整条轨道的底色
  container: {
    flexDirection: 'row',
    width: '86%',
    maxWidth: 360,
    minHeight: 76,
    backgroundColor: nativeGlass ? 'transparent' : 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    borderWidth: nativeGlass ? 0 : StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,233,226,0.9)',
    shadowColor: '#6cab88',
    shadowOpacity: nativeGlass ? 0 : 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    borderRadius: 999,
    margin: 5,
    justifyContent: 'center',
  },
  fallbackItem: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  itemInner: {
    flex: 1,
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  focusText: {
    color: '#0f5c3f',
  },
  blurText: {
    color: '#667981',
  },
});
