import React from 'react';
import { AccessibilityInfo, DynamicColorIOS, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TRACK_STYLE = { style: 'regular', animate: true, animationDuration: 0.2 };
const ACTIVE_STYLE = { style: 'clear', animate: true, animationDuration: 0.16 };

function supportsNativeGlass() {
  return Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
}

function GlassTrack({ style }) {
  return <GlassView style={style} glassEffectStyle={TRACK_STYLE} tintColor="rgba(255,255,255,0.06)" />;
}

export default function LiquidGlassTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const canUseGlass = supportsNativeGlass();
  const tabColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: '#111111', dark: '#ffffff' })
    : '#17392d';
  const inactiveColor = Platform.OS === 'ios'
    ? DynamicColorIOS({ light: '#5f6b73', dark: '#d2d8dd' })
    : '#667981';

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}> 
      <View style={styles.shell}>
        {canUseGlass ? <GlassTrack style={styles.trackGlass} /> : <View style={styles.fallbackTrack} />}
        <View style={styles.trackStroke} pointerEvents="none" />

        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;
            const { options } = descriptors[route.key];
            const rawLabel = options.tabBarLabel ?? options.title ?? route.name;
            const label = typeof rawLabel === 'string' ? rawLabel : route.name;
            const color = isFocused ? tabColor : inactiveColor;
            const icon = options.tabBarIcon
              ? options.tabBarIcon({ focused: isFocused, color, size: index === 1 ? 26 : 22 })
              : <Ionicons name="ellipse-outline" size={22} color={color} />;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                style={[styles.tabButton, index === 1 && styles.centerButton]}
              >
                {isFocused ? (
                  canUseGlass ? (
                    <GlassView style={styles.activeGlass} glassEffectStyle={ACTIVE_STYLE} tintColor="rgba(255,255,255,0.03)" />
                  ) : (
                    <View style={styles.activeFallback} />
                  )
                ) : null}

                <View style={styles.tabInner}>
                  {icon}
                  <Text style={[styles.tabLabel, { color }]}>{label}</Text>
                </View>
              </Pressable>
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
  shell: {
    width: '86%',
    maxWidth: 360,
    minHeight: 74,
    borderRadius: 999,
    justifyContent: 'center',
  },
  trackGlass: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
  },
  fallbackTrack: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.84)',
    overflow: 'hidden',
    shadowColor: '#6cab88',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  trackStroke: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  tabRow: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  tabButton: {
    flex: 1,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  centerButton: {
    flex: 1.08,
  },
  activeGlass: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 2,
    bottom: 2,
    borderRadius: 999,
  },
  activeFallback: {
    position: 'absolute',
    left: 2,
    right: 2,
    top: 2,
    bottom: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 2,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
