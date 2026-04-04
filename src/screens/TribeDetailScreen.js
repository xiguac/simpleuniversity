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

function TribeEventCard({ item, hidden, onOpen }) {
  const cardRef = useRef(null);

  const handlePress = async () => {
    const layout = await measureRef(cardRef);
    if (layout) {
      onOpen(item, layout, 'compact');
    }
  };

  return (
    <Animated.View ref={cardRef} collapsable={false} style={[styles.eventWrap, hidden && styles.hiddenCard]}>
      <Pressable style={styles.eventCard} onPress={handlePress}>
        <UniversalImage uri={item.logo} style={styles.eventLogo} />
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.eventTime}>{item.startTime}</Text>
          <Text style={styles.eventCredit}>+{item.credit} 学分</Text>
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

  const isSameActivityId = (a, b) => `${a}` === `${b}`;

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
        renderItem={({ item }) => (
          <TribeEventCard
            item={item}
            hidden={isSameActivityId(activeActivityId, item.id)}
            onOpen={(entry, layout, variant) => openActivity(entry, layout, variant, { topOffset: headerOffset })}
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
  eventWrap: { marginBottom: 15 },
  hiddenCard: { opacity: 0 },
  eventCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: '#f1f2f6' },
  eventLogo: { width: 70, height: 70, borderRadius: 10 },
  eventInfo: { flex: 1, marginLeft: 15, justifyContent: 'space-around' },
  eventTitle: { fontSize: 15, fontWeight: 'bold', color: '#2c3e50' },
  eventTime: { fontSize: 11, color: '#95a5a6' },
  eventCredit: { fontSize: 13, color: '#e67e22', fontWeight: 'bold' },
});
