import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useActivityOverlay } from '../context/ActivityOverlayContext';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

function normalizeId(value) {
  return `${value ?? ''}`;
}
const TABS = [
  { key: 'joined', label: '已报名', type: 2 },
  { key: 'pending', label: '审核中', type: 1 },
  { key: 'rejected', label: '未通过', type: 3 },
];

const UniversalImage = ({ uri, style }) => {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="" />;
  }
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={style} resizeMode="cover" />;
};

function measureRef(ref) {
  return new Promise((resolve) => {
    if (!ref?.current?.measureInWindow) {
      resolve(null);
      return;
    }
    ref.current.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

function MyActivityCard({ item, hidden, onOpen, translateY }) {
  const cardRef = useRef(null);
  const titleRef = useRef(null);
  const creditRef = useRef(null);
  const countRef = useRef(null);

  const handlePress = async () => {
    const [layout, titleLayout, creditLayout, countLayout] = await Promise.all([
      measureRef(cardRef),
      measureRef(titleRef),
      measureRef(creditRef),
      measureRef(countRef),
    ]);
    if (layout) {
      const sourceTextLayouts = {
        title: titleLayout ? { ...titleLayout, fontSize: 16 } : null,
        credit: creditLayout ? { ...creditLayout, fontSize: 12 } : null,
        count: countLayout ? { ...countLayout, fontSize: 11 } : null,
      };
      onOpen(item, layout, 'default', { sourceTextLayouts });
    }
  };
  return (
    <Animated.View
      ref={cardRef}
      collapsable={false}
      style={[
        styles.cardWrap,
        hidden && styles.hiddenCard,
        translateY ? { transform: [{ translateY }] } : null,
      ]}
    >
      <Pressable style={styles.activityCard} onPress={handlePress}>
        <UniversalImage uri={item.logo} style={styles.activityLogo} />
        <View style={styles.cardContent}>
          <Text ref={titleRef} style={styles.activityTitle} numberOfLines={2}>{item.name}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={14} color="#95a5a6" />
              <Text style={styles.infoText}>{item.startTime?.substring(5, 16)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="ribbon-outline" size={14} color="#e67e22" />
              <Text ref={creditRef} style={[styles.infoText, styles.creditText]}>+{item.credit} 学分</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.statusTag}>
              <Text style={styles.statusText}>{item.statusName || '进行中'}</Text>
            </View>
            <Text ref={countRef} style={styles.countText}>已报 {item.joinUserCount || 0}/{item.allowUserCount || 0}</Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function MyActivitiesScreen() {
  const navigation = useNavigation();
  const { authFetchJson } = useAuth();
  const {
    openActivity,
    closeActivity,
    activeActivityId,
    returningActivityId,
    activityReturnHeight,
    activityReturnProgress,
    isActivityOpen,
  } = useActivityOverlay();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const headerOffset = Math.max(0, headerHeight - insets.top);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchList = async (tab) => {
    setLoading(true);
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      const json = await authFetchJson('https://apis.pocketuni.net/apis/activity/myList', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}:${baseUserInfo.sid}`,
        },
        body: JSON.stringify({ type: tab.type, page: 1, limit: 10 }),
      });

      if (json.code === 0) {
        setItems(json.data?.list ?? []);
      } else {
        setItems([]);
      }
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        console.error(error);
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList(activeTab);
  }, [activeTab]);

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isActivityOpen,
      headerLeft: isActivityOpen
        ? () => (
            <Pressable onPress={closeActivity} style={{ paddingHorizontal: 10, paddingVertical: 6 }}>
              <Ionicons name="chevron-back" size={24} color="#20323a" />
            </Pressable>
          )
        : undefined,
    });
  }, [closeActivity, isActivityOpen, navigation]);

  useEffect(() => {
    if (!isActivityOpen) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeActivity();
      return true;
    });
    return () => subscription.remove();
  }, [closeActivity, isActivityOpen]);

  const buildReturnShift = (index, list) => {
    if (!returningActivityId || !activityReturnProgress) {
      return null;
    }

    const targetId = normalizeId(returningActivityId);
    const targetIndex = list.findIndex((entry) => normalizeId(entry?.id) === targetId);
    if (targetIndex === -1 || index === targetIndex || Math.abs(index - targetIndex) > 2) {
      return null;
    }

    const direction = index < targetIndex ? -1 : 1;
    const distance = Math.max(activityReturnHeight - 18, 0);
    const damp = Math.abs(index - targetIndex) === 2 ? 0.56 : 1;

    return activityReturnProgress.interpolate({
      inputRange: [0, 0.58, 0.82, 1],
      outputRange: [0, direction * distance * 0.54 * damp, direction * distance * 0.2 * damp, 0],
    });
  };
  const hiddenActivityId = normalizeId(activeActivityId);
  const returningTargetId = normalizeId(returningActivityId);

  return (
    <View style={styles.container}>
      <View style={[styles.tabBarWrap, { paddingTop: 8 }]}>
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = tab.key === activeTab.key;
            return (
              <Pressable key={tab.key} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#2ecc71" />
        </View>
      ) : (
        <FlatList
          data={items}
          extraData={`${activeActivityId ?? ''}-${returningActivityId ?? ''}-${isActivityOpen}`}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>当前没有相关活动</Text>}
          renderItem={({ item, index }) => (
            <MyActivityCard
              item={item}
              hidden={hiddenActivityId && normalizeId(item?.id) === hiddenActivityId && normalizeId(item?.id) !== returningTargetId}
              translateY={buildReturnShift(index, items)}
              onOpen={(entry, layout, variant, options = {}) => openActivity(entry, layout, variant, { topOffset: headerOffset, ...options })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  tabBarWrap: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: '#f4f7f6' },
  tabBar: { flexDirection: 'row', padding: 4, backgroundColor: '#eaf1ef', borderRadius: 18 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 14 },
  tabBtnActive: { backgroundColor: '#ffffff' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#799097' },
  tabTextActive: { color: '#20323a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 36 },
  emptyText: { textAlign: 'center', color: '#92a2a9', marginTop: 30 },
  cardWrap: { marginBottom: 15 },
  hiddenCard: { opacity: 0 },
  activityCard: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 22, padding: 12, elevation: 2 },
  activityLogo: { width: 100, height: 100, borderRadius: 15 },
  cardContent: { flex: 1, marginLeft: 15, justifyContent: 'space-between' },
  activityTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
  infoGrid: { marginTop: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  infoText: { color: '#7f8c8d', marginLeft: 6, fontSize: 12 },
  creditText: { color: '#e67e22', fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTag: { backgroundColor: '#f1f2f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, color: '#95a5a6' },
  countText: { fontSize: 11, color: '#95a5a6' },
});



