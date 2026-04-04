import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Image,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from './AuthContext';

const ActivityOverlayContext = createContext(null);
const { width: screenWidth } = Dimensions.get('window');
const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };
const EXPAND_DURATION = 320;
const COLLAPSE_DURATION = 280;
const DRAG_CLOSE_DISTANCE = 260;

function UniversalImage({ uri, style }) {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="" />;
  }
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={style} resizeMode="cover" />;
}

function buildTargetLayout(insets, topOffset = 0) {
  return {
    x: 20,
    y: insets.top + topOffset + 16,
    width: screenWidth - 40,
    height: 124,
  };
}

function ActivityOverlay({ state, progress, onClose, onJoin }) {
  const insets = useSafeAreaInsets();
  const dragStartProgress = useRef(1);
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        progress.stopAnimation((value) => {
          dragStartProgress.current = typeof value === 'number' ? value : 1;
        });
      },
      onPanResponderMove: (_, gesture) => {
        const nextProgress = Math.max(0, Math.min(1, dragStartProgress.current - gesture.dy / DRAG_CLOSE_DISTANCE));
        progress.setValue(nextProgress);
      },
      onPanResponderRelease: (_, gesture) => {
        const currentProgress = Math.max(0, Math.min(1, dragStartProgress.current - gesture.dy / DRAG_CLOSE_DISTANCE));
        if (gesture.dy > 96 || gesture.vy > 1.2 || currentProgress < 0.72) {
          onClose();
          return;
        }
        Animated.spring(progress, {
          toValue: 1,
          damping: 20,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  if (!state.visible || !state.item || !state.sourceLayout) {
    return null;
  }

  const extraTopOffset = state.topOffset || 0;
  const targetLayout = buildTargetLayout(insets, extraTopOffset);
  const left = progress.interpolate({ inputRange: [0, 1], outputRange: [state.sourceLayout.x, targetLayout.x] });
  const top = progress.interpolate({ inputRange: [0, 1], outputRange: [state.sourceLayout.y, targetLayout.y] });
  const cardWidth = progress.interpolate({ inputRange: [0, 1], outputRange: [state.sourceLayout.width, targetLayout.width] });
  const cardHeight = progress.interpolate({ inputRange: [0, 1], outputRange: [state.sourceLayout.height, targetLayout.height] });
  const radius = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [state.variant === 'compact' ? 20 : 22, 22],
  });
  const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const pageOpacity = progress.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0, 0.72, 1] });
  const detailOpacity = progress.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0.18, 1] });
  const detailTranslateY = progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const closeOpacity = progress.interpolate({ inputRange: [0.45, 1], outputRange: [0, 1] });

  const baseInfo = state.detail?.baseInfo || state.item;
  const userStatus = state.detail?.userStatus;
  const isJoined = userStatus?.hasJoin === 1;
  const isFull = state.detail ? state.detail.baseInfo.joinUserCount >= state.detail.baseInfo.allowUserCount : false;
  const isEnded = state.detail?.baseInfo?.statusName === '已结束';

  const renderParticipants = (detailBaseInfo) => {
    let typeLabel = '参与对象';
    let content = '全校学生';

    if (detailBaseInfo.allowUserType === 1) {
      const colleges = detailBaseInfo.allowCollege?.map((entry) => entry.name).join('、') || '全校各院';
      const years = detailBaseInfo.allowYear?.map((entry) => entry.name).join('、') || '各年级';
      typeLabel = '院系 / 年级';
      content = `学院：${colleges}\n年级：${years}`;
    } else if (detailBaseInfo.allowUserType === 2) {
      typeLabel = '指定部落';
      content = detailBaseInfo.allowTribe?.map((entry) => entry.name).join('、') || '不限部落';
    } else if (detailBaseInfo.allowUserType === 3) {
      typeLabel = '指定分支';
      content = detailBaseInfo.allowBranch?.map((entry) => entry.name).join('、') || '不限分支';
    }

    return (
      <View style={styles.infoRow}>
        <Ionicons name="school-outline" size={18} color="#9b59b6" />
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoLabel}>{typeLabel}</Text>
          <Text style={styles.infoVal}>{content}</Text>
        </View>
      </View>
    );
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>

      <Animated.View pointerEvents="none" style={[styles.pageFill, { opacity: pageOpacity }]} />

      <Animated.View
        style={[
          styles.overlayCard,
          {
            left,
            top,
            width: cardWidth,
            height: cardHeight,
            borderRadius: radius,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <UniversalImage uri={baseInfo.logo} style={styles.overlayImage} />
        <View style={styles.overlayCardContent}>
          <Text style={styles.overlayTitle} numberOfLines={state.variant === 'compact' ? 1 : 2}>{baseInfo.name}</Text>
          <Text style={styles.overlayCredit}>+{baseInfo.credit} 学分</Text>
          <Text style={styles.overlayCount}>已报 {baseInfo.joinUserCount || 0}/{baseInfo.allowUserCount || 0}</Text>
        </View>
      </Animated.View>

      <Animated.View pointerEvents="box-none" style={[styles.detailLayer, { opacity: detailOpacity, transform: [{ translateY: detailTranslateY }] }]}>
        <View style={[styles.detailTopBar, { top: insets.top + extraTopOffset + 6 }]}>
          <Animated.View style={{ opacity: closeOpacity }}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={22} color="#20323a" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <ScrollView style={styles.detailScroll} contentContainerStyle={{ paddingTop: targetLayout.y + targetLayout.height + 8, paddingBottom: 150 }}>
          {state.loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#2ecc71" size="large" />
            </View>
          ) : state.detail ? (
            <>
              <View style={styles.contentCard}>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={18} color="#2ecc71" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>活动时间</Text>
                    <Text style={styles.infoVal}>{state.detail.baseInfo.startTime} 至 {state.detail.baseInfo.endTime}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={18} color="#3498db" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>活动地点</Text>
                    <Text style={styles.infoVal}>{state.detail.baseInfo.address || '暂无详细地点'}</Text>
                  </View>
                </View>

                {renderParticipants(state.detail.baseInfo)}

                <View style={styles.infoRow}>
                  <Ionicons name="person-outline" size={18} color="#e67e22" />
                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>发布人</Text>
                    <Text style={styles.infoVal}>{state.detail.baseInfo.creatorName}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.descSection}>
                <Text style={styles.sectionTitle}>活动简介</Text>
                <Text style={styles.description}>{state.detail.baseInfo.description || '暂无内容'}</Text>
              </View>
            </>
          ) : null}
        </ScrollView>

        {state.detail ? (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + 10 }]}>
            <TouchableOpacity
              style={[styles.joinBtn, (isJoined || isEnded || isFull) && styles.joinBtnDisabled]}
              onPress={onJoin}
              disabled={isJoined || isEnded || isFull || state.joining}
            >
              {state.joining ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.joinBtnText}>{isJoined ? '已报名' : isEnded ? '已结束' : isFull ? '名额已满' : '立即报名'}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function ActivityOverlayProvider({ children }) {
  const { authFetchJson } = useAuth();
  const [state, setState] = useState({
    visible: false,
    activityId: null,
    item: null,
    sourceLayout: null,
    variant: 'default',
    detail: null,
    loading: false,
    joining: false,
    topOffset: 0,
  });
  const [returnState, setReturnState] = useState({
    active: false,
    activityId: null,
    height: 0,
  });
  const progress = useRef(new Animated.Value(0)).current;
  const returnProgress = useRef(new Animated.Value(0)).current;

  const fetchDetail = useCallback(async (activityId) => {
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      const json = await authFetchJson('https://apis.pocketuni.net/apis/activity/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}:${baseUserInfo.sid}`,
        },
        body: JSON.stringify({ id: activityId }),
      });

      if (json.code === 0) {
        setState((current) => (current.activityId === activityId ? { ...current, detail: json.data, loading: false } : current));
      } else {
        setState((current) => (current.activityId === activityId ? { ...current, loading: false } : current));
      }
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        Alert.alert('错误', '加载活动详情失败');
      }
      setState((current) => (current.activityId === activityId ? { ...current, loading: false } : current));
    }
  }, [authFetchJson]);

  const openActivity = useCallback((item, sourceLayout, variant = 'default', options = {}) => {
    const topOffset = Math.max(0, Number(options.topOffset) || 0);
    progress.stopAnimation();
    progress.setValue(0);
    returnProgress.stopAnimation();
    returnProgress.setValue(0);
    setReturnState({ active: false, activityId: null, height: 0 });
    setState({
      visible: true,
      activityId: item.id,
      item,
      sourceLayout,
      variant,
      detail: null,
      loading: true,
      joining: false,
      topOffset,
    });
    fetchDetail(item.id);
    Animated.spring(progress, {
      toValue: 1,
      damping: 14,
      stiffness: 170,
      mass: 0.82,
      overshootClamping: false,
      useNativeDriver: false,
    }).start();
  }, [fetchDetail, progress, returnProgress]);

  const closeActivity = useCallback(() => {
    const closingId = state.activityId;
    const closingHeight = state.sourceLayout?.height ?? 0;

    progress.stopAnimation();
    returnProgress.stopAnimation();
    returnProgress.setValue(0);
    setReturnState({
      active: true,
      activityId: closingId,
      height: closingHeight,
    });

    Animated.parallel([
      Animated.timing(progress, {
        toValue: 0,
        duration: COLLAPSE_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(returnProgress, {
        toValue: 1,
        damping: 15,
        stiffness: 160,
        mass: 0.9,
        overshootClamping: false,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setState({
        visible: false,
        activityId: null,
        item: null,
        sourceLayout: null,
        variant: 'default',
        detail: null,
    loading: false,
    joining: false,
    topOffset: 0,
  });
      setReturnState({ active: false, activityId: null, height: 0 });
      progress.setValue(0);
      returnProgress.setValue(0);
    });
  }, [progress, returnProgress, state.activityId, state.sourceLayout]);

  const joinActivity = useCallback(async () => {
    setState((current) => ({ ...current, joining: true }));
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      const currentActivityId = state.activityId;
      const resJson = await authFetchJson('https://apis.pocketuni.net/apis/activity/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}:${baseUserInfo.sid}`,
        },
        body: JSON.stringify({ activityId: currentActivityId }),
      });

      if (resJson.code === 0) {
        Alert.alert('报名成功', resJson.data?.msg || '请留意活动签到时间');
        setState((current) => ({
          ...current,
          joining: false,
          detail: current.detail
            ? {
                ...current.detail,
                userStatus: { ...current.detail.userStatus, hasJoin: 1 },
                baseInfo: {
                  ...current.detail.baseInfo,
                  joinUserCount: current.detail.baseInfo.joinUserCount + 1,
                },
              }
            : current.detail,
        }));
      } else {
        Alert.alert('提示', resJson.message || '报名失败');
        setState((current) => ({ ...current, joining: false }));
      }
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        Alert.alert('错误', '网络请求失败');
      }
      setState((current) => ({ ...current, joining: false }));
    }
  }, [authFetchJson, state.activityId]);

  const value = useMemo(
    () => ({
      openActivity,
      closeActivity,
      activeActivityId: state.activityId,
      isActivityOpen: state.visible,
      returningActivityId: returnState.active ? returnState.activityId : null,
      activityReturnHeight: returnState.height,
      activityReturnProgress: returnProgress,
    }),
    [openActivity, closeActivity, returnProgress, returnState.active, returnState.activityId, returnState.height, state.activityId, state.visible]
  );

  return (
    <ActivityOverlayContext.Provider value={value}>
      {children}
      <ActivityOverlay state={state} progress={progress} onClose={closeActivity} onJoin={joinActivity} />
    </ActivityOverlayContext.Provider>
  );
}

export function useActivityOverlay() {
  const context = useContext(ActivityOverlayContext);
  if (!context) {
    throw new Error('useActivityOverlay must be used within ActivityOverlayProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(21, 30, 36, 0.22)' },
  pageFill: { ...StyleSheet.absoluteFillObject, backgroundColor: '#f4f7f6' },
  overlayCard: {
    position: 'absolute',
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  overlayImage: { width: 100, height: 100, borderRadius: 15, backgroundColor: '#eef3f1' },
  overlayCardContent: { flex: 1, marginLeft: 15, justifyContent: 'space-between' },
  overlayTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
  overlayCredit: { fontSize: 12, fontWeight: '700', color: '#e67e22' },
  overlayCount: { fontSize: 11, color: '#95a5a6' },
  detailLayer: { ...StyleSheet.absoluteFillObject },
  detailTopBar: { position: 'absolute', left: 0, right: 0, zIndex: 2, paddingHorizontal: 16 },
  closeButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.88)' },
  detailScroll: { flex: 1 },
  loadingBox: { paddingTop: 80, alignItems: 'center' },
  contentCard: { marginHorizontal: 20, backgroundColor: 'white', borderRadius: 25, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  infoTextContainer: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 12, color: '#95a5a6', marginBottom: 4 },
  infoVal: { fontSize: 15, color: '#34495e', fontWeight: '500', lineHeight: 22 },
  descSection: { marginTop: 25, paddingHorizontal: 25 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 12 },
  description: { fontSize: 15, color: '#7f8c8d', lineHeight: 26 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, backgroundColor: 'rgba(255,255,255,0.98)' },
  joinBtn: { backgroundColor: '#2ecc71', borderRadius: 18, padding: 18, alignItems: 'center' },
  joinBtnDisabled: { backgroundColor: '#bdc3c7' },
  joinBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});





