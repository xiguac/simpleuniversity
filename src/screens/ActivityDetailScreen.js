import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHeaderHeight } from '@react-navigation/elements';
import { useAuth } from '../context/AuthContext';
import { buildPuHeaders } from '../api/puApi';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

const UniversalImage = ({ uri, style }) => {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="" />;
  }
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={style} resizeMode="cover" />;
};

export default function ActivityDetailScreen({ route }) {
  const { activityId, previewItem } = route.params;
  const headerHeight = useHeaderHeight();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const { authFetchJson } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user_data');
        const { token, baseUserInfo } = JSON.parse(savedUser);
        const json = await authFetchJson('https://apis.pocketuni.net/apis/activity/info', {
          method: 'POST',
          headers: buildPuHeaders(token, baseUserInfo.sid),
          body: JSON.stringify({ id: activityId }),
        });
        if (json.code === 0) {
          setDetail(json.data);
        }
      } catch (error) {
        if (error.code !== 'AUTH_EXPIRED') {
          Alert.alert('错误', '加载活动详情失败');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activityId, authFetchJson]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      const resJson = await authFetchJson('https://apis.pocketuni.net/apis/activity/join', {
        method: 'POST',
        headers: buildPuHeaders(token, baseUserInfo.sid, { needSign: true }),
        body: JSON.stringify({ activityId }),
      });

      if (resJson.code === 0) {
        Alert.alert('报名成功', resJson.data?.msg || '请留意活动签到时间');
        setDetail((prev) => ({
          ...prev,
          userStatus: { ...prev.userStatus, hasJoin: 1 },
          baseInfo: { ...prev.baseInfo, joinUserCount: prev.baseInfo.joinUserCount + 1 },
        }));
      } else {
        Alert.alert('提示', resJson.message || '报名失败');
      }
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        Alert.alert('错误', `网络请求失败: ${error?.message || error}`);
      }
    } finally {
      setJoining(false);
    }
  };

  const handleCancel = async () => {
    setJoining(true);
    try {
      const savedUser = await AsyncStorage.getItem('user_data');
      const { token, baseUserInfo } = JSON.parse(savedUser);
      // 官方接口：取消报名无需 X-Sign
      const resJson = await authFetchJson('https://apis.pocketuni.net/apis/activity/cancel', {
        method: 'POST',
        headers: buildPuHeaders(token, baseUserInfo.sid),
        body: JSON.stringify({ activityId }),
      });

      if (resJson.code === 0) {
        Alert.alert('已取消报名', '如需再次报名请留意活动名额');
        setDetail((prev) => ({
          ...prev,
          userStatus: { ...prev.userStatus, hasJoin: 0 },
          baseInfo: { ...prev.baseInfo, joinUserCount: Math.max(0, (prev.baseInfo.joinUserCount || 1) - 1) },
        }));
      } else {
        Alert.alert('提示', resJson.message || '取消报名失败');
      }
    } catch (error) {
      if (error.code !== 'AUTH_EXPIRED') {
        Alert.alert('错误', `网络请求失败: ${error?.message || error}`);
      }
    } finally {
      setJoining(false);
    }
  };

  const renderParticipants = (baseInfo) => {
    let typeLabel = '参与对象';
    let content = '全校学生';

    if (baseInfo.allowUserType === 1) {
      const colleges = baseInfo.allowCollege?.map((item) => item.name).join('、') || '全校各院';
      const years = baseInfo.allowYear?.map((item) => item.name).join('、') || '各年级';
      typeLabel = '院系 / 年级';
      content = `学院：${colleges}\n年级：${years}`;
    } else if (baseInfo.allowUserType === 2) {
      typeLabel = '指定部落';
      content = baseInfo.allowTribe?.map((item) => item.name).join('、') || '不限部落';
    } else if (baseInfo.allowUserType === 3) {
      typeLabel = '指定分支';
      content = baseInfo.allowBranch?.map((item) => item.name).join('、') || '不限分支';
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

  const baseInfo = detail?.baseInfo || previewItem;
  const userStatus = detail?.userStatus;
  const isJoined = userStatus?.hasJoin === 1;
  const isFull = detail ? detail.baseInfo.joinUserCount >= detail.baseInfo.allowUserCount : false;
  const isEnded = detail?.baseInfo?.statusName === '已结束';

  if (loading && !baseInfo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2ecc71" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 20 }]}>
        <View style={styles.heroCard}>
          <UniversalImage uri={baseInfo.logo} style={styles.detailLogo} />
          <View style={styles.headerRight}>
            <Text style={styles.detailTitle}>{baseInfo.name}</Text>
            <View style={styles.creditBadge}>
              <Ionicons name="ribbon-outline" size={14} color="#e67e22" />
              <Text style={styles.creditText}>+{baseInfo.credit} 学分</Text>
            </View>
            <Text style={styles.registeredCount}>
              已报 {baseInfo.joinUserCount || 0}/{baseInfo.allowUserCount || 0}
            </Text>
          </View>
        </View>

        {detail ? (
          <>
            <View style={styles.contentCard}>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color="#2ecc71" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>活动时间</Text>
                  <Text style={styles.infoVal}>
                    {detail.baseInfo.startTime} 至 {detail.baseInfo.endTime}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={18} color="#3498db" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>活动地点</Text>
                  <Text style={styles.infoVal}>{detail.baseInfo.address || '暂无详细地点'}</Text>
                </View>
              </View>

              {renderParticipants(detail.baseInfo)}

              <View style={styles.infoRow}>
                <Ionicons name="person-outline" size={18} color="#e67e22" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>发布人</Text>
                  <Text style={styles.infoVal}>{detail.baseInfo.creatorName}</Text>
                </View>
              </View>
            </View>

            <View style={styles.descSection}>
              <Text style={styles.sectionTitle}>活动简介</Text>
              <Text style={styles.description}>{detail.baseInfo.description || '暂无内容'}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      {detail ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.joinBtn, isJoined && styles.cancelBtn, !isJoined && (isEnded || isFull) && styles.joinBtnDisabled]}
            onPress={isJoined ? handleCancel : handleJoin}
            disabled={joining || !isJoined && (isEnded || isFull)}
          >
            {joining ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.joinBtnText}>
                {isJoined ? '取消报名' : isEnded ? '已结束' : isFull ? '名额已满' : '立即报名'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: 20, paddingBottom: 150 },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 22,
    padding: 12,
    marginBottom: 24,
  },
  detailLogo: {
    width: 100,
    height: 100,
    borderRadius: 15,
    backgroundColor: '#eef3f1',
  },
  headerRight: { flex: 1, marginLeft: 15, justifyContent: 'space-between' },
  detailTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50', lineHeight: 25 },
  creditBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3e0',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  creditText: { color: '#e67e22', fontWeight: 'bold', fontSize: 14 },
  registeredCount: { color: '#95a5a6', fontSize: 13 },
  contentCard: {
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  infoTextContainer: { marginLeft: 12, flex: 1 },
  infoLabel: { fontSize: 12, color: '#95a5a6', marginBottom: 4 },
  infoVal: { fontSize: 15, color: '#34495e', fontWeight: '500', lineHeight: 22 },
  descSection: { marginTop: 25, paddingHorizontal: 5 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 12 },
  description: { fontSize: 15, color: '#7f8c8d', lineHeight: 26 },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'white',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 35 : 20,
    elevation: 20,
  },
  joinBtn: { backgroundColor: '#2ecc71', borderRadius: 18, padding: 18, alignItems: 'center' },
  joinBtnDisabled: { backgroundColor: '#bdc3c7' },
  cancelBtn: { backgroundColor: '#e74c3c' },
  joinBtnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});
