import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassContainer, GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// iOS 底部导航：一个椭圆形灰白底框 + 三个等宽按钮
// iOS 26+ 使用 expo-glass-effect 液态玻璃（GlassContainer 聚合三个 GlassView）；
// 其余平台回退为纯 View 实现，视觉一致。
const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

const BAR_HEIGHT = 72;
const BAR_WIDTH = '86%';
const MAX_WIDTH = 380;

const ICONS = ['calendar-outline', 'qr-code-outline', 'person-outline'];

export default function LiquidGlassTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const label = (route) => {
    const { options } = descriptors[route.key];
    const raw = options.tabBarLabel ?? options.title ?? route.name;
    return typeof raw === 'string' ? raw : route.name;
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      {/* 椭圆形灰白底框：与玻璃铝片坐标完全对齐 */}
      <View style={styles.base}>
        <View style={[styles.bar, nativeGlass ? styles.barGlass : styles.barPlain]}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const item = (
              <Pressable
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
              >
                <Ionicons
                  name={ICONS[index] || 'ellipse-outline'}
                  size={22}
                  color={isFocused ? '#0f5c3f' : '#667981'}
                />
                <Text style={[styles.label, isFocused ? styles.labelOn : styles.labelOff]}>
                  {label(route)}
                </Text>
              </Pressable>
            );

            if (!nativeGlass) {
              return <View key={route.key} style={styles.cellWrap}>{item}</View>;
            }
            return (
              <GlassView
                key={route.key}
                isInteractive
                colorScheme="light"
                glassEffectStyle={
                  isFocused
                    ? { style: 'clear', animate: true, animationDuration: 0.35 }
                    : { style: 'none', animate: true, animationDuration: 0.35 }
                }
                style={styles.cellWrap}
              >
                {item}
              </GlassView>
            );
          })}
        </View>
      </View>
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
  // 椭圆形框的定位容器，垫底与玻璃条共用同一坐标
  base: {
    width: BAR_WIDTH,
    maxWidth: MAX_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: 999,
    alignItems: 'stretch',
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 999,
    overflow: 'hidden',
  },
  // 非玻璃（Android / 低版本 iOS）：灰白色实底椭圆框
  barPlain: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(220,233,226,0.9)',
    shadowColor: '#6cab88',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  // 玻璃版本：框体直接带白色底，三个玻璃按钮浮在其上
  barGlass: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,228,221,0.9)',
    shadowColor: '#6cab88',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cellWrap: {
    flex: 1,
    borderRadius: 999,
  },
  cell: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  cellPressed: {
    backgroundColor: 'rgba(15,92,63,0.06)',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelOn: {
    color: '#0f5c3f',
  },
  labelOff: {
    color: '#667981',
  },
});
