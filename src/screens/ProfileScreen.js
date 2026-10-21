import React, { useEffect, useState } from 'react';
import { buildPuHeaders } from '../api/puApi';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

const IMAGE_HEADERS = {
  Referer: 'https://class.pocketuni.net/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

const UniversalImage = ({ uri, style }) => {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="avatar" />;
  }
  const { Image } = require('react-native');
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={style} resizeMode="cover" />;
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { authFetchJson } = useAuth();
  const [userInfo, setUserInfo] = useState(null);
  const [creditData, setCreditData] = useState({ totalCredit: '0.00', cx: '100%' });

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedData = await AsyncStorage.getItem('user_data');
        if (savedData) {
          const userData = JSON.parse(savedData);
          setUserInfo(userData);

          const resJson = await authFetchJson('https://apis.pocketuni.net/apis/user/pc-info', {
            method: 'POST',
            headers: buildPuHeaders(userData.token, userData.baseUserInfo.sid),
            body: JSON.stringify({}),
          });

          // pc-info 返回：{credit, cx, event, tribe, ...}；cx 即诚信度
          if (resJson.code === 0 && resJson.data) {
            setCreditData({
              totalCredit: resJson.data.credit ?? '0.00',
              cx: resJson.data.cx ?? '100%',
            });
          }
        }
      } catch (error) {
        if (error.code !== 'AUTH_EXPIRED') {
          console.error('Failed to load profile data:', error);
        }
      }
    };

    loadData();
  }, [authFetchJson]);

  if (!userInfo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2ecc71" />
      </View>
    );
  }

  const avatarUrl =
    userInfo.baseUserInfo?.avatar?.url ||
    userInfo.fullProfile?.face ||
    'https://img.pocketuni.net/data/lzlg/sys_pic/boydefault.png';

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.userCard}>
          <UniversalImage uri={avatarUrl} style={styles.avatarImage} />
          <View style={styles.userTextContent}>
            <Text style={styles.userName}>{userInfo.fullProfile?.realname || '未登录'}</Text>
            <Text style={styles.schoolName}>{userInfo.fullProfile?.school || '未知学校'}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.smallCard}>
            <Text style={styles.cardLabel}>实践学分</Text>
            <Text style={styles.cardValue}>{creditData.totalCredit}</Text>
          </View>
          <View style={styles.smallCard}>
            <Text style={styles.cardLabel}>诚信度</Text>
            <Text style={[styles.cardValue, { color: '#3498db' }]}>{creditData.cx}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.listCard} activeOpacity={0.7} onPress={() => navigation.navigate('MyActivities')}>
          <View style={styles.listLeft}>
            <View style={[styles.listIconBg, { backgroundColor: '#eef8ff' }]}>
              <Ionicons name="reader-outline" size={20} color="#3498db" />
            </View>
            <Text style={styles.listCardText}>我的活动</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.listCard} activeOpacity={0.7} onPress={() => navigation.navigate('TribeList')}>
          <View style={styles.listLeft}>
            <View style={[styles.listIconBg, { backgroundColor: '#e8f8f0' }]}>
              <Ionicons name="people-outline" size={20} color="#2ecc71" />
            </View>
            <Text style={styles.listCardText}>我的部落</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { paddingTop: 18, paddingBottom: 130 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  userCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 25,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  avatarImage: { width: 74, height: 74, borderRadius: 37, marginRight: 20, backgroundColor: '#f0f0f0' },
  userTextContent: { flex: 1, justifyContent: 'center' },
  userName: { fontSize: 22, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  schoolName: { color: '#7f8c8d', fontSize: 14 },
  row: { flexDirection: 'row', paddingHorizontal: 10, marginTop: 10, marginBottom: 12 },
  smallCard: {
    flex: 1,
    backgroundColor: 'white',
    margin: 10,
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardLabel: { color: '#95a5a6', fontSize: 14, marginBottom: 8 },
  cardValue: { fontSize: 22, fontWeight: 'bold', color: '#2ecc71' },
  listCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  listLeft: { flexDirection: 'row', alignItems: 'center' },
  listIconBg: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  listCardText: { fontSize: 16, fontWeight: '600', color: '#2c3e50' },
});
