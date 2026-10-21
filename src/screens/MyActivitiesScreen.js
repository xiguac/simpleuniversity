import React, { useEffect, useRef, useState } from 'react';
import { buildPuHeaders } from '../api/puApi';
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
import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useActivityOverlay } from '../context/ActivityOverlayContext';
import GlassFill, { nativeGlass } from '../ui/GlassFill';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

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

function MyActivityCard({ item, onOpen }) {
  const cardRef = useRef(null);
  const titleRef = useRef(null);
  const creditRef = useRef(null);
  const countRef = useRef(null);

  const handlePress = async () => {
    const layout = await measureRef(cardRef);
    if (layout) {
      onOpen(item, layout, 'default', {});
    }
  };
  return (
    <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
      <Pressable style={styles.activityCard} onPress={handlePress}>
        <GlassFill radius={22} />
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
    </View>
  );
}

export default function MyActivitiesScreen() {
  const navigation = useNavigation();
  const { authFetchJson } = useAuth();
  const { openActivity } = useActivityOverlay();
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
        headers: buildPuHeaders(token, baseUserInfo.sid),
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

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
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
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>当前没有相关活动</Text>}
          renderItem={({ item }) => (
            <MyActivityCard
              item={item}
              onOpen={(entry, layout, variant, options = {}) => openActivity(entry, layout, variant, { topOffset: headerOffset, ...options }, navigation)}
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
  activityCard: { flexDirection: 'row', backgroundColor: nativeGlass ? 'rgba(255,255,255,0.45)' : 'white', borderRadius: 22, padding: 12, elevation: 2 },
  activityLogo: { width: 100, height: 100, borderRadius: 15 },
  cardContent: { flex: 1, marginLeft: 15, justifyContent: 'space-between' },
  activityTitle: { fontSize: 16, fontWeight: '700', color: '#2c3e50' },
  infoGrid: { marginTop: 8 },
  infoItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  infoText: { color: '#7f8c8d', marginLeft: 6, fontSize: 12 },
  creditText: { color: '#e67e22', fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusTag: { backgroundColor: nativeGlass ? 'rgba(255,255,255,0.6)' : '#f1f2f6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, color: '#95a5a6' },
  countText: { fontSize: 11, color: '#95a5a6' },
});



