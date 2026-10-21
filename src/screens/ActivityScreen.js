import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { buildPuHeaders } from '../api/puApi';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useActivityOverlay } from '../context/ActivityOverlayContext';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

function normalizeId(value) {
  return `${value ?? ''}`;
}

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

const ActivityCard = memo(function ActivityCard({ item, onOpen }) {
  const cardRef = useRef(null);

  const handlePress = async () => {
    const layout = await measureRef(cardRef);
    if (layout) {
      onOpen(item, layout, 'default', {});
    }
  };

  return (
    <View ref={cardRef} collapsable={false} style={styles.cardWrap}>
      <Pressable style={styles.activityCard} onPress={handlePress}>
        <UniversalImage uri={item.logo} style={styles.activityLogo} />
        <View style={styles.cardContent}>
          <Text style={styles.activityTitle} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={14} color="#95a5a6" />
              <Text style={styles.infoText}>{item.startTime?.substring(5, 16)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="ribbon-outline" size={14} color="#e67e22" />
              <Text style={[styles.infoText, styles.creditText]}>+{item.credit} 学分</Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.statusTag}>
              <Text style={styles.statusText}>{item.statusName}</Text>
            </View>
            <Text style={styles.countText}>已报 {item.joinUserCount}/{item.allowUserCount}</Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
});

function TribeSearchCard({ item, navigation }) {
  return (
    <TouchableOpacity style={styles.tribeCard} activeOpacity={0.9} onPress={() => navigation.navigate('TribeDetail', { tribeID: item.id })}>
      <UniversalImage uri={item.logo} style={styles.tribeLogo} />
      <View style={styles.tribeInfo}>
        <Text style={styles.tribeName}>{item.name}</Text>
        <Text style={styles.tribeMeta}>{item.typeName} / {item.org}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#b6c0c4" />
    </TouchableOpacity>
  );
}

export default function ActivityScreen({ navigation }) {
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [activityResults, setActivityResults] = useState([]);
  const [tribeResults, setTribeResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const refreshingRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const { authFetchJson } = useAuth();
  const { openActivity } = useActivityOverlay();
  // 打开活动详情：把屏幕自身 navigation 交给 openActivity 用于路由
  const openDetail = useCallback(
    (item, layout, variant, options) => openActivity(item, layout, variant, options, navigation),
    [openActivity, navigation],
  );

  const fetchActivities = async (pageNum, isRefresh = false) => {
    if (isRefresh) {
      if (refreshingRef.current) {
        return;
      }
      refreshingRef.current = true;
      setRefreshing(true);
    } else {
      if (loadingMoreRef.current || refreshingRef.current) {
        return;
      }
      loadingMoreRef.current = true;
    }

    setLoading(true);
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      const resJson = await authFetchJson('https://apis.pocketuni.net/apis/activity/list', {
        method: 'POST',
        headers: buildPuHeaders(token, baseUserInfo.sid),
        body: JSON.stringify({ sort: 0, page: pageNum, limit: 10, puType: 0 }),
      });

      if (resJson.code === 0 && resJson.data?.list) {
        const seen = new Set();
        const dedupe = (list) => list.filter((a) => {
          const id = String(a?.id);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        if (isRefresh) {
          setActivities(dedupe(resJson.data.list));
          setPage(1);
        } else {
          setActivities((prev) => dedupe([...prev, ...resJson.data.list]));
          setPage(pageNum);
        }
        setHasMore(resJson.data.list.length >= 10);
      }
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        console.error(error);
      }
    } finally {
      if (isRefresh) {
        refreshingRef.current = false;
        setRefreshing(false);
      } else {
        loadingMoreRef.current = false;
      }
      setLoading(false);
    }
  };

  const searchAll = async (keyword) => {
    const text = keyword.trim();
    if (!text) {
      setSubmittedQuery('');
      setActivityResults([]);
      setTribeResults([]);
      setSearching(false);
      return;
    }

    setSubmittedQuery(text);
    setSearching(true);
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      const headers = buildPuHeaders(token, baseUserInfo.sid);

      const [activityJson, tribeJson] = await Promise.all([
        authFetchJson('https://apis.pocketuni.net/apis/activity/list', {
          method: 'POST',
          headers,
          body: JSON.stringify({ page: 1, limit: 10, title: text }),
        }),
        authFetchJson('https://apis.pocketuni.net/apis/tribe/list', {
          method: 'POST',
          headers,
          body: JSON.stringify({ page: 1, limit: 20, title: text }),
        }),
      ]);

      setActivityResults(activityJson.code === 0 ? activityJson.data?.list ?? [] : []);
      setTribeResults(tribeJson.code === 0 ? tribeJson.data?.list ?? [] : []);
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        console.error(error);
        Alert.alert('提示', '搜索失败，请稍后再试');
      }
      setActivityResults([]);
      setTribeResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    fetchActivities(1, true);
  }, []);

  const isSearchingMode = submittedQuery.length > 0;

  const header = (
    <View style={styles.headerBlock}>
      <Text style={styles.pageTitle}>发现活动</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color="#8da0a9" />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索活动或部落"
          placeholderTextColor="#97a6ad"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => searchAll(query)}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              setQuery('');
              setSubmittedQuery('');
              setActivityResults([]);
              setTribeResults([]);
            }}
          >
            <Ionicons name="close-circle" size={18} color="#97a6ad" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.searchAction} activeOpacity={0.9} onPress={() => searchAll(query)}>
          <Text style={styles.searchActionText}>搜索</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isSearchingMode) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.searchContent} keyboardShouldPersistTaps="handled">
          {header}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>活动结果</Text>
            {searching ? <ActivityIndicator size="small" color="#2ecc71" /> : null}
          </View>
          {!searching && activityResults.length === 0 ? <Text style={styles.emptyHint}>没有找到相关活动</Text> : null}
          {activityResults.map((item) => (
            <ActivityCard
              key={`activity-${item.id}`}
              item={item}
              onOpen={openDetail}
            />
          ))}

          <View style={[styles.sectionHeader, styles.searchSectionSpacing]}>
            <Text style={styles.sectionTitle}>部落结果</Text>
          </View>
          {!searching && tribeResults.length === 0 ? <Text style={styles.emptyHint}>没有找到相关部落</Text> : null}
          {tribeResults.map((item) => <TribeSearchCard key={`tribe-${item.id}`} item={item} navigation={navigation} />)}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <FlatList
        data={activities}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ActivityCard
            item={item}
            onOpen={openDetail}
          />
        )}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listPadding}
        onEndReached={() => {
          if (hasMore && !loadingMoreRef.current && !refreshingRef.current) {
            fetchActivities(page + 1);
          }
        }}
        onEndReachedThreshold={0.45}
        removeClippedSubviews={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={6}
        refreshing={refreshing}
        onRefresh={() => fetchActivities(1, true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  listPadding: { padding: 15, paddingBottom: 128 },
  searchContent: { padding: 15, paddingBottom: 128 },
  headerBlock: { marginBottom: 18 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#20323a', marginBottom: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 18, paddingHorizontal: 14, minHeight: 52, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 15, color: '#22343c' },
  searchAction: { marginLeft: 10, backgroundColor: '#2ecc71', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  searchActionText: { color: 'white', fontSize: 13, fontWeight: '700' },
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 10 },
  searchSectionSpacing: { marginTop: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#22343c' },
  emptyHint: { color: '#8fa0a6', fontSize: 14, marginBottom: 12 },
  tribeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 18, padding: 12, marginBottom: 12 },
  tribeLogo: { width: 54, height: 54, borderRadius: 14, backgroundColor: '#f0f0f0' },
  tribeInfo: { flex: 1, marginLeft: 14 },
  tribeName: { fontSize: 15, fontWeight: '700', color: '#20323a' },
  tribeMeta: { marginTop: 4, fontSize: 12, color: '#91a0a7' },
});
