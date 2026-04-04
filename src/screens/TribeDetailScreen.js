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
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useActivityOverlay } from '../context/ActivityOverlayContext';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

function normalizeId(value) {
  return `${value ?? ''}`;
}

const UniversalImage = ({ uri, style, radius = 10 }) => {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, borderRadius: radius, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="img" />;
  }
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={[style, { borderRadius: radius }]} resizeMode="cover" />;
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

function TribeEventCard({ item, hidden, onOpen, translateY }) {
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
      style={[styles.eventWrap, hidden && styles.hiddenCard, translateY ? { transform: [{ translateY }] } : null]}
    >
      <Pressable style={styles.eventCard} onPress={handlePress}>
        <UniversalImage uri={item.logo} style={styles.eventLogo} radius={15} />
        <View style={styles.eventInfo}>
          <Text ref={titleRef} style={styles.eventTitle} numberOfLines={2}>{item.name}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={14} color="#95a5a6" />
              <Text style={styles.eventTime}>{item.startTime?.substring(5, 16)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="ribbon-outline" size={14} color="#e67e22" />
              <Text ref={creditRef} style={styles.eventCredit}>+{item.credit} 学分</Text>
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

export default function TribeDetailScreen({ route }) {
  const navigation = useNavigation();
  const { tribeID } = route.params;
  const [info, setInfo] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const headerOffset = Math.max(0, headerHeight - insets.top);
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

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user_data');
        const { token, baseUserInfo } = JSON.parse(savedUser);

        const [infoJson, eventJson] = await Promise.all([
          authFetchJson('https://apis.pocketuni.net/apis/tribe/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}:${baseUserInfo.sid}` },
            body: JSON.stringify({ tribeID }),
          }),
          authFetchJson('https://apis.pocketuni.net/apis/tribe/eventList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}:${baseUserInfo.sid}` },
            body: JSON.stringify({ tribeID, page: 1, limit: 10 }),
          }),
        ]);

        if (infoJson.code === 0) {
          setInfo(infoJson.data);
        }
        if (eventJson.code === 0) {
          setEvents(eventJson.data.list ?? []);
        }
      } catch (error) {
        if (error.code !== 'AUTH_EXPIRED') {
          console.error(error);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetchJson, tribeID]);

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isActivityOpen) {
        return;
      }
      event.preventDefault();
      closeActivity();
    });
    return unsubscribe;
  }, [closeActivity, isActivityOpen, navigation]);

  if (loading || !info) {
    return <View style={styles.center}><ActivityIndicator color="#2ecc71" /></View>;
  }

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
      <FlatList
        data={events}
        extraData={`${activeActivityId ?? ''}-${returningActivityId ?? ''}-${isActivityOpen}`}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <UniversalImage uri={info.logo} style={styles.bigLogo} radius={25} />
              <Text style={styles.name}>{info.name}</Text>
              <Text style={styles.typeTag}>{info.typeName}</Text>
            </View>
            <Text style={styles.sectionTitle}>部落活动</Text>
          </>
        )}
        renderItem={({ item, index }) => (
          <TribeEventCard
            item={item}
            hidden={hiddenActivityId && normalizeId(item?.id) === hiddenActivityId && normalizeId(item?.id) !== returningTargetId}
            translateY={buildReturnShift(index, events)}
            onOpen={(entry, layout, variant, options = {}) => openActivity(entry, layout, variant, { topOffset: headerOffset, ...options })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  listContent: { paddingBottom: 40, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', padding: 30, backgroundColor: 'white', borderBottomWidth: 10, borderBottomColor: '#f4f7f6', marginHorizontal: -20 },
  bigLogo: { width: 90, height: 90, backgroundColor: '#f9f9f9' },
  name: { fontSize: 22, fontWeight: 'bold', marginTop: 15 },
  typeTag: { backgroundColor: '#e8f8f0', color: '#2ecc71', padding: 6, borderRadius: 8, marginTop: 10, fontSize: 12, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 15 },
  eventWrap: { marginBottom: 15, backgroundColor: 'white', borderRadius: 22 },
  hiddenCard: { opacity: 0 },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f2f6',
    elevation: 2,
  },
  eventLogo: { width: 100, height: 100 },
  eventInfo: { flex: 1, marginLeft: 15, justifyContent: 'space-between' },
  eventTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
  infoGrid: { marginTop: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  eventTime: { color: '#7f8c8d', marginLeft: 6, fontSize: 12 },
  eventCredit: { color: '#e67e22', marginLeft: 6, fontSize: 12, fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTag: { backgroundColor: '#f1f2f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, color: '#95a5a6' },
  countText: { fontSize: 11, color: '#95a5a6' },
});
