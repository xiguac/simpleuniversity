import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { buildPuHeaders } from '../api/puApi';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

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

function TribeEventCard({ item, onOpen }) {
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
    <View ref={cardRef} collapsable={false} style={styles.eventWrap}>
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
    </View>
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
  const { openActivity } = useActivityOverlay();

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user_data');
        const { token, baseUserInfo } = JSON.parse(savedUser);

        const [infoJson, eventJson] = await Promise.all([
          authFetchJson('https://apis.pocketuni.net/apis/tribe/info', {
            method: 'POST',
            headers: buildPuHeaders(token, baseUserInfo.sid),
            body: JSON.stringify({ tribeID }),
          }),
          authFetchJson('https://apis.pocketuni.net/apis/tribe/eventList', {
            method: 'POST',
            headers: buildPuHeaders(token, baseUserInfo.sid),
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

  if (loading || !info) {
    return <View style={styles.center}><ActivityIndicator color="#2ecc71" /></View>;
  }

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <FlatList
        data={events}
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
        renderItem={({ item }) => (
          <TribeEventCard
            item={item}
            onOpen={(entry, layout, variant, options = {}) => openActivity(entry, layout, variant, { topOffset: headerOffset, ...options }, navigation)}
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
