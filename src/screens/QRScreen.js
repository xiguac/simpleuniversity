import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Dimensions, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Brightness from 'expo-brightness';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import GlassFill, { nativeGlass } from '../ui/GlassFill';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import { buildUserQrPlain, desEncrypt, fetchServerTimeSeconds, QR_TTL_SECONDS } from '../api/puExtra';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const GLASS = Platform.OS === 'ios' && isGlassEffectAPIAvailable();

export default function QRScreen() {
  const { authFetchJson } = useAuth();
  const [qrValue, setQrValue] = useState('LOADING');
  const [timeLeft, setTimeLeft] = useState(QR_TTL_SECONDS);
  const [userInfo, setUserInfo] = useState(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const qrOpacity = useRef(new Animated.Value(1)).current;
  const qrScale = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);
  const brightnessTaskRef = useRef(Promise.resolve());

  const generateEncryptedQR = useCallback(async (user) => {
    if (!user || !user.baseUserInfo) {
      return;
    }

    try {
      const timestamp = await fetchServerTimeSeconds(authFetchJson, user.token, user.baseUserInfo.sid);
      setQrValue(desEncrypt(buildUserQrPlain(user.baseUserInfo.id, timestamp, user.baseUserInfo.username)));
    } catch (error) {
      console.error('身份码刷新失败', error);
    }
  }, [authFetchJson]);

  const startCountdown = useCallback((user) => {
    generateEncryptedQR(user);
    setTimeLeft(QR_TTL_SECONDS);
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: QR_TTL_SECONDS * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          Animated.sequence([
            Animated.parallel([
              Animated.timing(qrOpacity, {
                toValue: 0.22,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(qrScale, {
                toValue: 0.94,
                duration: 150,
                useNativeDriver: true,
              }),
            ]),
            Animated.delay(30),
          ]).start(() => {
            generateEncryptedQR(user);
            qrOpacity.setValue(0.4);
            qrScale.setValue(1.05);
            Animated.parallel([
              Animated.timing(qrOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(qrScale, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          });

          progressAnim.setValue(1);
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: QR_TTL_SECONDS * 1000,
            easing: Easing.linear,
            useNativeDriver: true,
          }).start();
          return QR_TTL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
  }, [generateEncryptedQR, progressAnim, qrOpacity, qrScale]);

  const stopCountdown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressAnim.stopAnimation();
  }, [progressAnim]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let originalBrightness = null;
      let usedSystemBrightness = false;

      const updateBrightness = (brighten) => {
        brightnessTaskRef.current = brightnessTaskRef.current.then(async () => {
          if (brighten) {
            if (!active || AppState.currentState !== 'active') return;
            if (originalBrightness == null) {
              usedSystemBrightness = Platform.OS === 'android' && await Brightness.isUsingSystemBrightnessAsync();
              originalBrightness = await Brightness.getBrightnessAsync();
            }
            if (active && AppState.currentState === 'active') await Brightness.setBrightnessAsync(1);
          } else if (originalBrightness != null) {
            if (usedSystemBrightness) await Brightness.restoreSystemBrightnessAsync();
            else await Brightness.setBrightnessAsync(originalBrightness);
            originalBrightness = null;
          }
        }).catch((error) => console.error('身份码亮度调整失败', error));
      };

      const prepare = async () => {
        try {
          const savedData = await AsyncStorage.getItem('user_data');
          if (!savedData || !active) {
            return;
          }

          const parsed = JSON.parse(savedData);
          setUserInfo(parsed);
          startCountdown(parsed);
          updateBrightness(true);
        } catch (error) {
          console.error(error);
        }
      };

      prepare();
      const subscription = AppState.addEventListener('change', (state) => updateBrightness(state === 'active'));

      return () => {
        active = false;
        subscription.remove();
        stopCountdown();
        setTimeLeft(QR_TTL_SECONDS);
        updateBrightness(false);
      };
    }, [startCountdown, stopCountdown])
  );

  if (!userInfo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2ecc71" />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <View style={styles.qrCard}>
        <GlassFill radius={35} />
        <View style={styles.header}>
          <Text style={styles.qrTitle}>身份码</Text>
        </View>

        <View style={styles.qrContainer}>
          <Animated.View
            style={[
              styles.qrBorder,
              {
                opacity: qrOpacity,
                transform: [{ scale: qrScale }],
              },
            ]}
          >
            {qrValue !== 'LOADING' ? (
              <QRCode value={qrValue} size={width * 0.55} color="#2c3e50" backgroundColor="white" quietZone={10} />
            ) : (
              <View style={styles.qrLoadingBox}>
                <ActivityIndicator color="#ccc" />
              </View>
            )}
          </Animated.View>

          <View style={styles.progressBg}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  transform: [{ scaleX: progressAnim }],
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.timerText}>
            <Text style={styles.secondsText}>{timeLeft}</Text> 秒后自动刷新
          </Text>
        </View>
      </View>

      {GLASS ? (
        <View style={[styles.tipsBox, { backgroundColor: 'transparent' }]}>
          <GlassView style={styles.tipsGlass} glassEffectStyle="regular" tintColor="rgba(232,248,240,0.45)">
            <Text style={styles.tipsText}>提示：进入页面时已自动调高亮度，离开后会恢复</Text>
          </GlassView>
        </View>
      ) : (
        <View style={styles.tipsBox}>
          <Text style={styles.tipsText}>提示：进入页面时已自动调高亮度，离开后会恢复</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f7f6' },
  qrCard: {
    width: width * 0.85,
    backgroundColor: nativeGlass ? 'rgba(255,255,255,0.5)' : 'white',
    borderRadius: 35,
    padding: 30,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  header: { alignItems: 'center', marginBottom: 25 },
  qrTitle: { fontSize: 24, fontWeight: 'bold', color: '#2ecc71', letterSpacing: 2 },
  qrContainer: { alignItems: 'center', justifyContent: 'center', width: '100%' },
  qrBorder: { padding: 10, borderWidth: 1, borderColor: '#f0f0f0', borderRadius: 20, backgroundColor: 'white' },
  qrLoadingBox: { width: width * 0.55, height: width * 0.55, justifyContent: 'center', alignItems: 'center' },
  progressBg: { width: '100%', height: 4, backgroundColor: '#f0f0f0', marginTop: 20, borderRadius: 2, overflow: 'hidden' },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2ecc71',
    transformOrigin: 'left center',
  },
  footer: { marginTop: 20, flexDirection: 'row', alignItems: 'center' },
  timerText: { color: '#7f8c8d', fontSize: 14 },
  secondsText: { color: '#2ecc71', fontWeight: 'bold', fontSize: 18 },
  tipsBox: { marginTop: 30, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#e8f8f0', borderRadius: 20 },
  tipsGlass: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  tipsText: { color: '#27ae60', fontSize: 13, fontWeight: '500' },
});
