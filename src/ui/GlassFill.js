import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';

// iOS 26+ 为 true：这时每张卡片的背景会换成系统液态玻璃
// 其它平台（Android / 低版本 iOS）组件自身返回 null，屏幕里的回退纯白底色生效
export const nativeGlass = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

/**
 * 卡片内的液态玻璃底层：
 * 用法——把原有的白色卡片 View/Pressable 改成透明背景，然后把它作为第一个子元素插入：
 *   <Pressable style={styles.card}>
 *     <GlassFill radius={22} />
 *     ...原有内容...
 *   </Pressable>
 * 不改变任何布局逻辑（绝对定位铺满，内容自然叠在其上）。
 */
export default function GlassFill({ radius = 0, tint, isInteractive = false }) {
  if (!nativeGlass) {
    return null;
  }
  return (
    <View
      pointerEvents={isInteractive ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
    >
      <GlassView
        style={{ flex: 1 }}
        glassEffectStyle="regular"
        colorScheme="light"
        isInteractive={isInteractive}
        tintColor={tint}
      />
    </View>
  );
}
