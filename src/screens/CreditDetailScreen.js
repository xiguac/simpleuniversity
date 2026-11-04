import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import GlassFill, { nativeGlass } from '../ui/GlassFill';
import { fetchCreditRecords } from '../api/puExtra';

const TYPES = [
  { key: 1, label: '已发放' },
  { key: 2, label: '未发放' },
];
const EMPTY_IDS = [];

function fmtCredit(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value == null ? '0' : String(value);
  return num.toFixed(2);
}

function fmtTime(item) {
  if (item?.startTime && item?.endTime) return `${item.startTime} ~ ${item.endTime}`;
  if (item?.startTime) return String(item.startTime);
  if (item?.createdAt) return String(item.createdAt);
  if (item?.finishTime) return String(item.finishTime);
  return '';
}

export default function CreditDetailScreen({ route }) {
  const { ids = EMPTY_IDS, kind = 'activity', year = 0, title = '学分明细' } = route.params || {};
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { authFetchJson } = useAuth();

  const [token, setToken] = useState('');
  const [sid, setSid] = useState('');
  const [type, setType] = useState(1);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState('');
  const requestRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('user_data');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        setToken(parsed?.token || '');
        setSid(parsed?.baseUserInfo?.sid ?? '');
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const numericIds = useMemo(
    () => (Array.isArray(ids) ? ids : String(ids).split(',')).map((v) => Number(v)).filter((v) => Number.isFinite(v)),
    [ids]
  );

  const loadPage = useCallback(
    async (targetPage, replace) => {
      if (!token || !sid) return;
      const requestId = replace ? ++requestRef.current : requestRef.current;
      if (!replace && loadingMoreRef.current) return;
      loadingMoreRef.current = !replace;
      if (replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      try {
        const json = await fetchCreditRecords(authFetchJson, token, sid, {
          kind,
          type,
          page: targetPage,
          limit: 20,
          ids: numericIds,
          year,
        });
        if (requestId !== requestRef.current) return;
        if (json?.code === 0) {
          const list = json?.data?.list || [];
          setItems((prev) => (replace ? list : [...prev, ...list]));
          setHasMore(list.length >= 20);
          setPage(targetPage);
          setError('');
        } else {
          if (replace) setItems([]);
          setHasMore(false);
          setError(json?.message || '加载失败');
        }
      } catch (e) {
        if (requestId === requestRef.current && e.code !== 'AUTH_EXPIRED') {
          if (replace) setItems([]);
          setHasMore(false);
          setError(e?.message || '网络请求失败');
        }
      } finally {
        if (requestId === requestRef.current) {
          loadingMoreRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [authFetchJson, token, sid, kind, type, numericIds, year]
  );

  useEffect(() => {
    if (!token || !sid) return;
    setPage(1);
    loadPage(1, true);
    return () => { requestRef.current += 1; };
  }, [token, sid, type, loadPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await loadPage(1, true);
    setRefreshing(false);
  }, [loadPage]);

  const onEndReached = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const next = page + 1;
    loadPage(next, false);
  }, [loading, loadingMore, hasMore, page, loadPage]);

  const topPadding = Math.max(headerHeight, insets.top + 12) + 8;

  const renderItem = ({ item, index }) => {
    const reason = item?.finishReason || item?.noCreditReason || item?.finishRemark || '';
    const time = fmtTime(item);
    return (
      <View style={styles.item}>
        <GlassFill radius={18} />
        <View style={styles.itemHeader}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item?.name || '未命名记录'}
          </Text>
          <Text style={styles.itemCredit}>+{fmtCredit(item?.credit)}</Text>
        </View>
        {time ? <Text style={styles.itemTime}>{time}</Text> : null}
        <View style={styles.itemFooter}>
          <View style={[styles.tag, type === 1 ? styles.tagOk : styles.tagPending]}>
            <Text style={[styles.tagText, type === 1 ? styles.tagTextOk : styles.tagTextPending]}>
              {type === 1 ? '已发放' : '未发放'}
            </Text>
          </View>
          {reason ? (
            <Text style={styles.reason} numberOfLines={2}>
              {reason}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.headerBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.tabBar}>
          {TYPES.map((item) => {
            const active = item.key === type;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setType(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
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
          keyExtractor={(item, index) => String(item?.id ?? `${index}`)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ecc71" />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="file-tray-outline" size={34} color="#c8d4d8" />
              <Text style={styles.emptyText}>{error || `暂无${type === 1 ? '已发放' : '未发放'}记录`}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#2ecc71" style={{ marginVertical: 16 }} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  headerBlock: { paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', color: '#20323a', marginBottom: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#eaf1ef',
    borderRadius: 16,
    padding: 4,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 13 },
  tabBtnActive: { backgroundColor: 'white' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#799097' },
  tabTextActive: { color: '#20323a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, flexGrow: 1 },
  item: {
    backgroundColor: nativeGlass ? 'rgba(255,255,255,0.5)' : 'white',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  itemName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#2c3e50', lineHeight: 21 },
  itemCredit: { fontSize: 17, fontWeight: '900', color: '#e67e22', marginLeft: 10 },
  itemTime: { fontSize: 11, color: '#92a2a9', marginTop: 8 },
  itemFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  tagOk: { backgroundColor: '#e8f8f0' },
  tagPending: { backgroundColor: '#fff3e0' },
  tagText: { fontSize: 11, fontWeight: '700' },
  tagTextOk: { color: '#27ae60' },
  tagTextPending: { color: '#e67e22' },
  reason: { flex: 1, fontSize: 11, color: '#a6b4ba', marginLeft: 8 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 12, color: '#92a2a9', marginTop: 10 },
});
