import React, { useEffect, useState } from 'react';
import { buildPuHeaders } from '../api/puApi';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const IMAGE_HEADERS = { Referer: 'https://class.pocketuni.net/', 'User-Agent': 'Mozilla/5.0' };

const UniversalImage = ({ uri, style }) => {
  if (Platform.OS === 'web') {
    return <img src={uri} style={{ ...style, objectFit: 'cover' }} referrerPolicy="no-referrer" alt="logo" />;
  }
  const { Image } = require('react-native');
  return <Image source={{ uri, headers: IMAGE_HEADERS }} style={style} />;
};

function TribeCard({ item, navigation }) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.cardInner} onPress={() => navigation.navigate('TribeDetail', { tribeID: item.id })}>
        <UniversalImage uri={item.logo} style={styles.logo} />
        <View style={styles.info}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.type}>{item.typeName} / {item.org}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </Pressable>
    </View>
  );
}

export default function TribeListScreen({ navigation }) {
  const [tribes, setTribes] = useState([]);
  const [loading, setLoading] = useState(true);
  const { authFetchJson } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const savedUser = await AsyncStorage.getItem('user_data');
        const { token, baseUserInfo } = JSON.parse(savedUser);
        const json = await authFetchJson('https://apis.pocketuni.net/apis/tribe/myList', {
          method: 'POST',
          headers: buildPuHeaders(token, baseUserInfo.sid),
          body: JSON.stringify({ type: 2, page: 1, limit: 10 }),
        });
        if (json.code === 0) {
          setTribes(json.data.list);
        }
      } catch (error) {
        if (error.code !== 'AUTH_EXPIRED') {
          console.error(error);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetchJson]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2ecc71" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tribes}
        contentContainerStyle={{ paddingVertical: 10, paddingBottom: 30 }}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <TribeCard item={item} navigation={navigation} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { marginHorizontal: 15, marginTop: 15 },
  cardInner: { flexDirection: 'row', backgroundColor: 'white', padding: 15, borderRadius: 18, alignItems: 'center', elevation: 2 },
  logo: { width: 55, height: 55, borderRadius: 12, backgroundColor: '#f0f0f0' },
  info: { flex: 1, marginLeft: 15 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  type: { color: '#95a5a6', fontSize: 12, marginTop: 4 },
});
