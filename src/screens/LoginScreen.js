import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function LoginScreen({ onLogin }) {
  const insets = useSafeAreaInsets();
  const [schools, setSchools] = useState([]);
  const [filteredSchools, setFilteredSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFetchingSchools, setIsFetchingSchools] = useState(true);

  useEffect(() => {
    fetch('https://pocketuni.net/index.php?app=api&mod=Sitelist&act=getSchools')
      .then((res) => res.json())
      .then((data) => {
        setSchools(data);
        setFilteredSchools(data);
      })
      .catch((err) => {
        console.error('Failed to fetch schools:', err);
        Alert.alert('网络提示', '获取学校列表失败，请检查网络');
      })
      .finally(() => {
        setIsFetchingSchools(false);
      });
  }, []);

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (!text) {
      setFilteredSchools(schools);
      return;
    }
    setFilteredSchools(schools.filter((school) => school.name && school.name.includes(text)));
  };

  const executeLogin = async () => {
    if (!selectedSchool || !username || !password) {
      Alert.alert('提示', '请选择学校并输入学号和密码');
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await fetch('https://apis.pocketuni.net/uc/user/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          DNT: '1',
          Origin: 'https://class.pocketuni.net',
          Referer: 'https://class.pocketuni.net/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        },
        body: JSON.stringify({
          sid: Number(selectedSchool.go_id),
          device: 'app',
          userName: username,
          password,
        }),
      });

      const resJson = await response.json();
      if (resJson.code === 0) {
        onLogin(resJson.data);
      } else {
        Alert.alert('登录失败', resJson.message || '账号或密码错误');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('错误', '网络请求失败，请稍后再试');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.loginContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.loginCard}>
          <Text style={styles.loginHeader}>简校园</Text>
          <Text style={styles.loginSubHeader}>Simple University</Text>

          <TouchableOpacity style={styles.inputBox} activeOpacity={0.7} onPress={() => setModalVisible(true)}>
            <Text style={{ color: selectedSchool ? '#333' : '#999', flex: 1, fontSize: 16 }}>
              {selectedSchool ? selectedSchool.name : '点击选择你的学校'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#ccc" />
          </TouchableOpacity>

          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputText}
              placeholder="请输入学号"
              value={username}
              onChangeText={setUsername}
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputBox}>
            <TextInput
              style={styles.inputText}
              placeholder="请输入密码"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoggingIn && { backgroundColor: '#7edfa5' }]}
            onPress={executeLogin}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? <ActivityIndicator color="white" /> : <Text style={styles.loginBtnText}>立即登录</Text>}
          </TouchableOpacity>
        </View>

        <Modal visible={modalVisible} animationType="slide" transparent={false} onRequestClose={() => setModalVisible(false)}>
          <View style={styles.modalRoot}>
            <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 18) + 12 }]}> 
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={28} color="#2c3e50" />
              </TouchableOpacity>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color="#95a5a6" />
                <TextInput
                  style={styles.modalSearchInput}
                  placeholder="搜索学校名称..."
                  placeholderTextColor="#9ca8af"
                  value={searchQuery}
                  onChangeText={handleSearch}
                  autoCorrect={false}
                />
              </View>
            </View>

            {isFetchingSchools ? (
              <View style={styles.loadingCenter}>
                <ActivityIndicator size="large" color="#2ecc71" />
                <Text style={styles.loadingText}>正在加载学校列表...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredSchools}
                keyExtractor={(item, index) => (item.school ? item.school.toString() : index.toString())}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={20}
                contentContainerStyle={styles.schoolListContent}
                ListEmptyComponent={<Text style={styles.emptyText}>未找到对应学校</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.schoolItem}
                    activeOpacity={0.6}
                    onPress={() => {
                      setSelectedSchool(item);
                      setModalVisible(false);
                      setSearchQuery('');
                      setFilteredSchools(schools);
                    }}
                  >
                    <Text style={styles.schoolName}>{item.name}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#d4dbe0" />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#2ecc71' },
  loginContainer: {
    flex: 1,
    backgroundColor: '#2ecc71',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 18,
  },
  loginCard: {
    width: width * 0.85,
    backgroundColor: 'white',
    borderRadius: 30,
    padding: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  loginHeader: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2ecc71',
    textAlign: 'center',
  },
  loginSubHeader: {
    fontSize: 14,
    color: '#bdc3c7',
    textAlign: 'center',
    marginBottom: 30,
    letterSpacing: 2,
  },
  inputBox: {
    backgroundColor: '#f5f6fa',
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  loginBtn: {
    backgroundColor: '#2ecc71',
    borderRadius: 15,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f2f6',
  },
  closeBtn: {
    padding: 6,
    marginRight: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f6fa',
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#2c3e50',
  },
  schoolListContent: {
    paddingBottom: 18,
  },
  schoolItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f6f7',
  },
  schoolName: {
    fontSize: 16,
    color: '#2c3e50',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#95a5a6',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#bdc3c7',
    fontSize: 16,
  },
});
