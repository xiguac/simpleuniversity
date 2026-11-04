import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import GlassFill, { nativeGlass } from '../ui/GlassFill';
import { fetchCreditCategory, fetchCreditIndex, fetchCreditYears } from '../api/puExtra';

const TABS = [
  { key: 'activity', label: '活动类' },
  { key: 'apply', label: '成果类' },
];

function fmtCredit(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value == null ? '0' : String(value);
  return num.toFixed(2);
}

export default function CreditScreen() {
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { authFetchJson } = useAuth();

  const [token, setToken] = useState('');
  const [sid, setSid] = useState('');
  const [indexData, setIndexData] = useState(null);
  const [tab, setTab] = useState('activity');
  const [categoryData, setCategoryData] = useState(null);
  const [years, setYears] = useState([]);
  const [year, setYear] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(0);

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

  const loadYears = useCallback(async () => {
    if (!token || !sid) return;
    try {
      const json = await fetchCreditYears(authFetchJson, token, sid);
      if (json?.code === 0 && Array.isArray(json?.data?.list)) {
        setYears(json.data.list.filter(Boolean));
      }
    } catch (e) {
      if (e.code !== 'AUTH_EXPIRED') console.warn('学年列表加载失败', e);
    }
  }, [authFetchJson, token, sid]);

  const loadIndex = useCallback(async (requestId) => {
    if (!token || !sid) return;
    try {
      const json = await fetchCreditIndex(authFetchJson, token, sid, year);
      if (requestId !== requestRef.current) return;
      if (json?.code === 0) {
        setIndexData(json.data || null);
      } else {
        setError(json?.message || '学分加载失败');
      }
    } catch (e) {
      if (requestId === requestRef.current && e.code !== 'AUTH_EXPIRED') setError(e?.message || '网络请求失败');
    }
  }, [authFetchJson, token, sid, year]);

  const loadCategory = useCallback(async (requestId) => {
    if (!token || !sid) return;
    try {
      const json = await fetchCreditCategory(authFetchJson, token, sid, tab, year);
      if (requestId !== requestRef.current) return;
      if (json?.code === 0) {
        setCategoryData(json.data || null);
      } else {
        setCategoryData(null);
        setError(json?.message || '学分类别加载失败');
      }
    } catch (e) {
      if (requestId === requestRef.current && e.code !== 'AUTH_EXPIRED') {
        setCategoryData(null);
        setError(e.message || '学分类别加载失败');
      }
    }
  }, [authFetchJson, token, sid, tab, year]);

  useEffect(() => {
    if (!token || !sid) return;
    const requestId = ++requestRef.current;
    let active = true;
    (async () => {
      setLoading(true);
      setRefreshing(false);
      setError('');
      await Promise.all([loadIndex(requestId), loadCategory(requestId), loadYears()]);
      if (active && requestId === requestRef.current) setLoading(false);
    })();
    return () => {
      active = false;
      requestRef.current += 1;
    };
  }, [token, sid, loadIndex, loadCategory, loadYears]);

  const onRefresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    setRefreshing(true);
    setError('');
    await Promise.all([loadIndex(requestId), loadCategory(requestId)]);
    if (requestId === requestRef.current) {
      setRefreshing(false);
      setLoading(false);
    }
  }, [loadIndex, loadCategory]);

  const totalCredit = useMemo(() => fmtCredit(indexData?.totalCredit), [indexData]);
  const rank = indexData?.pai?.rank;
  const activityCredit = useMemo(
    () => fmtCredit(indexData?.activityCredit ?? indexData?.convertCredit?.activityCredit),
    [indexData]
  );
  const applyCredit = useMemo(
    () => fmtCredit(indexData?.applyCredit ?? indexData?.convertCredit?.applyCredit),
    [indexData]
  );

  const list = categoryData?.list || [];
  const tabCredit = categoryData?.credit;

  const topPadding = Math.max(headerHeight, insets.top + 12) + 8;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2ecc71" />}
      >
        {/* 总览 */}
        <View style={styles.hero}>
          <GlassFill radius={24} />
          <Text style={styles.heroLabel}>实践学分</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroScore}>{totalCredit}</Text>
            <View style={styles.rankBox}>
              <Ionicons name="trophy-outline" size={14} color="#e67e22" />
              <Text style={styles.rankText}>
                {rank != null && Number(rank) > 0 ? `排名 ${rank}` : '暂无排名'}
              </Text>
            </View>
          </View>
          <View style={styles.heroSplit}>
            <View style={styles.heroItem}>
              <Text style={styles.heroItemLabel}>活动类</Text>
              <Text style={styles.heroItemValue}>{activityCredit}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroItem}>
              <Text style={styles.heroItemLabel}>成果类</Text>
              <Text style={styles.heroItemValue}>{applyCredit}</Text>
            </View>
          </View>
        </View>

        {/* 学年 */}
        {years.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearRow}
          >
            <TouchableOpacity
              style={[styles.yearChip, year === 0 && styles.yearChipActive]}
              onPress={() => setYear(0)}
              activeOpacity={0.8}
            >
              <Text style={[styles.yearText, year === 0 && styles.yearTextActive]}>全部</Text>
            </TouchableOpacity>
            {years.map((item) => {
              const active = String(year) === String(item.id);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={[styles.yearChip, active && styles.yearChipActive]}
                  onPress={() => setYear(item.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.yearText, active && styles.yearTextActive]}>{item.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 活动类 / 成果类 */}
        <View style={styles.tabBar}>
          {TABS.map((item) => {
            const active = item.key === tab;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setTab(item.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.listCard}>
          <GlassFill radius={22} />
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{tab === 'apply' ? '成果类' : '活动类'}得分</Text>
            <Text style={styles.listCredit}>{fmtCredit(tabCredit)}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color="#2ecc71" style={{ marginVertical: 30 }} />
          ) : error ? (
            <Text style={styles.emptyText}>{error}</Text>
          ) : list.length === 0 ? (
            <Text style={styles.emptyText}>暂无{tab === 'apply' ? '成果类' : '活动类'}学分记录</Text>
          ) : (
            list.map((item, index) => (
              <CategoryRow
                key={`${item.name || 'cate'}-${index}`}
                item={item}
                kind={tab}
                year={year}
                navigation={navigation}
              />
            ))
          )}
        </View>

        <Text style={styles.footerHint}>
          学分于发放次日凌晨生效；点击分类可查看已发放 / 未发放明细。
        </Text>
      </ScrollView>
    </View>
  );
}

function CategoryRow({ item, kind, year, navigation }) {
  const [expanded, setExpanded] = useState(false);
  const children = Array.isArray(item.children) ? item.children.filter(Boolean) : [];
  const ids = Array.isArray(item.ids) ? item.ids : item.ids != null ? String(item.ids).split(',') : item.id != null ? [item.id] : [];

  const open = (target) => {
    const targetIds = Array.isArray(target?.ids) ? target.ids : target?.ids != null ? String(target.ids).split(',') : target?.id != null ? [target.id] : ids;
    if (!targetIds.length) return;
    navigation.navigate('CreditDetail', {
      ids: targetIds,
      kind,
      year,
      title: target?.name || item.name || '学分明细',
      credit: target?.credit ?? item.credit,
    });
  };

  return (
    <View>
      <Pressable
        style={styles.categoryRow}
        onPress={() => {
          if (children.length) {
            setExpanded((prev) => !prev);
          } else {
            open(item);
          }
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.categoryName}>{item.name || '未命名分类'}</Text>
          {children.length ? (
            <Text style={styles.categorySub}>{expanded ? '收起' : '展开子分类'}</Text>
          ) : null}
        </View>
        <Text style={styles.categoryCredit}>{fmtCredit(item.credit)}</Text>
        <Ionicons
          name={children.length ? (expanded ? 'chevron-up' : 'chevron-down') : 'chevron-forward'}
          size={16}
          color="#b2c0c6"
          style={{ marginLeft: 6 }}
        />
      </Pressable>

      {expanded
        ? children.map((child, index) => (
            <Pressable
              key={`${child.name || 'child'}-${index}`}
              style={[styles.categoryRow, styles.childRow]}
              onPress={() => open(child)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.childName}>{child.name || '未命名'}</Text>
              </View>
              <Text style={styles.childCredit}>{fmtCredit(child.credit)}</Text>
              <Ionicons name="chevron-forward" size={15} color="#b2c0c6" style={{ marginLeft: 6 }} />
            </Pressable>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: nativeGlass ? 'rgba(255,255,255,0.5)' : 'white',
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
    marginBottom: 14,
    elevation: 2,
  },
  heroLabel: { fontSize: 13, color: '#92a2a9', fontWeight: '600' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 6 },
  heroScore: { fontSize: 40, fontWeight: '900', color: '#20323a', letterSpacing: -1 },
  rankBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff3e0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    marginLeft: 12,
    marginBottom: 8,
  },
  rankText: { fontSize: 12, color: '#e67e22', fontWeight: '700' },
  heroSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#f6f9f8',
    borderRadius: 16,
    paddingVertical: 12,
  },
  heroItem: { flex: 1, alignItems: 'center' },
  heroItemLabel: { fontSize: 11, color: '#92a2a9' },
  heroItemValue: { fontSize: 18, fontWeight: '800', color: '#2c3e50', marginTop: 3 },
  heroDivider: { width: 1, height: 26, backgroundColor: '#e3ebe8' },
  yearRow: { gap: 8, paddingBottom: 14 },
  yearChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 13,
    backgroundColor: '#eaf1ef',
  },
  yearChipActive: { backgroundColor: '#20323a' },
  yearText: { fontSize: 12, fontWeight: '700', color: '#6c8188' },
  yearTextActive: { color: 'white' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#eaf1ef',
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 13 },
  tabBtnActive: { backgroundColor: 'white' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#799097' },
  tabTextActive: { color: '#20323a' },
  listCard: {
    backgroundColor: nativeGlass ? 'rgba(255,255,255,0.5)' : 'white',
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eef3f1',
  },
  listTitle: { fontSize: 15, fontWeight: '800', color: '#20323a' },
  listCredit: { fontSize: 20, fontWeight: '900', color: '#2ecc71' },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f6f5',
  },
  categoryName: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  categorySub: { fontSize: 11, color: '#92a2a9', marginTop: 3 },
  categoryCredit: { fontSize: 15, fontWeight: '800', color: '#e67e22' },
  childRow: { paddingLeft: 14, backgroundColor: '#fafcfb' },
  childName: { fontSize: 13, color: '#5d7278', fontWeight: '600' },
  childCredit: { fontSize: 13, fontWeight: '700', color: '#e67e22' },
  emptyText: { fontSize: 12, color: '#92a2a9', textAlign: 'center', marginVertical: 26, lineHeight: 19 },
  footerHint: { fontSize: 11, color: '#a6b4ba', textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
