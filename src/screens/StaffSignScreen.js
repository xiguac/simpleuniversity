import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';
import GlassFill, { nativeGlass } from '../ui/GlassFill';
import {
  buildUserQrPlain,
  desEncrypt,
  fetchCanSignList,
  fetchServerTimeSeconds,
  isQrFresh,
  parseQrPayload,
  staffSign,
} from '../api/puExtra';
import {
  loadUserBook,
  mergeUserBook,
  normalizeUser,
  parseUserJson,
  removeUserFromBook,
} from '../utils/userBook';
import { shareUsers } from '../utils/exportUsers';

const MODES = [
  { key: 'in', label: '签到' },
  { key: 'out', label: '签退' },
];

function fmtActivity(item) {
  const start = item.startTime ? String(item.startTime).substring(5, 16) : '';
  const end = item.endTime ? String(item.endTime).substring(5, 16) : '';
  return start && end ? `${start} ~ ${end}` : start || end || '时间待定';
}

export default function StaffSignScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { authFetchJson } = useAuth();

  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState('');
  const [sid, setSid] = useState('');

  const [activities, setActivities] = useState([]);
  const [activityId, setActivityId] = useState(null);
  const [activityPicker, setActivityPicker] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(true);

  const [mode, setMode] = useState('in');
  const [book, setBook] = useState([]);
  const [busy, setBusy] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const scanLockRef = useRef(false);
  const submitLockRef = useRef(false);

  const [qrUser, setQrUser] = useState(null);
  const [qrValue, setQrValue] = useState('');
  const [qrLeft, setQrLeft] = useState(25);

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const tokenRef = useRef('');
  const sidRef = useRef('');

  const selectedActivity = useMemo(
    () => activities.find((item) => String(item.id) === String(activityId)) || null,
    [activities, activityId]
  );

  // 读取本地账号
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('user_data');
        if (!saved) return;
        const parsed = JSON.parse(saved);
        const user = normalizeUser(parsed);
        setCurrentUser(user);
        const tk = parsed?.token || '';
        const schoolId = parsed?.baseUserInfo?.sid ?? '';
        setToken(tk);
        setSid(schoolId);
        tokenRef.current = tk;
        sidRef.current = schoolId;
      } catch (error) {
        setLoadingActivities(false);
        Alert.alert('读取账号失败', error.message);
      }
    })();
  }, []);

  // 用户库
  useEffect(() => {
    loadUserBook().then(setBook).catch((error) => Alert.alert('读取用户库失败', error.message));
  }, []);

  // 可签到活动
  useEffect(() => {
    if (!token || !sid) return;
    (async () => {
      setLoadingActivities(true);
      try {
        const list = await fetchCanSignList(authFetchJson, token, sid);
        setActivities(list);
        if (list.length > 0) setActivityId(list[0].id);
      } catch (error) {
        if (error.code !== 'AUTH_EXPIRED') {
          Alert.alert('提示', error.message || '获取可签到活动失败');
        }
      } finally {
        setLoadingActivities(false);
      }
    })();
  }, [token, sid, authFetchJson]);

  // 二维码倒计时：每 25 秒重新取服务器时间
  useEffect(() => {
    if (!qrUser) return undefined;
    let cancelled = false;
    let left = 25;
    setQrValue('');
    const refresh = async () => {
      try {
        const ts = await fetchServerTimeSeconds(authFetchJson, tokenRef.current, sidRef.current);
        if (!cancelled) {
          setQrValue(desEncrypt(buildUserQrPlain(qrUser.id, ts, qrUser.username)));
          left = 25;
          setQrLeft(left);
        }
      } catch (error) {
        if (!cancelled && error.code !== 'AUTH_EXPIRED') Alert.alert('身份码刷新失败', error.message);
      }
    };
    refresh();
    const timer = setInterval(() => {
      left -= 1;
      if (left <= 0) {
        left = 25;
        refresh();
      }
      if (!cancelled) setQrLeft(left);
    }, 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [qrUser, authFetchJson]);

  const submitSign = useCallback(
    async ({ mid, signMode, label }) => {
      if (submitLockRef.current) return;
      if (!activityId) {
        Alert.alert('提示', '请先选择活动');
        return;
      }
      submitLockRef.current = true;
      setBusy(true);
      try {
        const json = await staffSign(authFetchJson, tokenRef.current, sidRef.current, {
          activityId,
          mid,
          mode: signMode,
        });
        if (json?.code === 0) {
          Alert.alert(
            signMode === 'out' ? '签退成功' : '签到成功',
            `${label || mid} 已完成${signMode === 'out' ? '签退' : '签到'}`
          );
        } else {
          Alert.alert('操作失败', json?.message || json?.msg || '请稍后重试');
        }
      } catch (error) {
        if (error.code !== 'AUTH_EXPIRED') {
          Alert.alert('操作失败', error?.message || '网络请求失败');
        }
      } finally {
        submitLockRef.current = false;
        setBusy(false);
      }
    },
    [activityId, authFetchJson]
  );

  const handleScannedText = useCallback(
    async (text) => {
      const parsed = parseQrPayload(text);
      if (!parsed) {
        Alert.alert('无法识别', '这不是有效的 PU 身份码');
        return;
      }
      if (parsed.kind !== 'user') {
        Alert.alert('暂不支持', '当前仅支持用户身份码，活动码请在活动详情中签到');
        return;
      }

      const serverTs = await fetchServerTimeSeconds(authFetchJson, tokenRef.current, sidRef.current);
      if (!isQrFresh(parsed.timestamp, serverTs)) {
        Alert.alert('二维码已失效', '请让对方刷新身份码后再试');
        return;
      }

      const who = parsed.username ? `学号 ${parsed.username}` : `ID ${parsed.id}`;
      const action = mode === 'out' ? '签退' : '签到';
      Alert.alert(`确认${action}`, `识别到 ${who}\n确定要${action}吗？`, [
        { text: '取消', style: 'cancel' },
        {
          text: `确认${action}`,
          onPress: () => submitSign({ mid: parsed.id, signMode: mode, label: who }),
        },
      ]);
    },
    [authFetchJson, mode, submitSign]
  );

  const handleBarcode = useCallback(
    ({ data }) => {
      if (scanLockRef.current) return;
      scanLockRef.current = true;
      setScanning(false);
      handleScannedText(data).catch((error) => {
        if (error.code !== 'AUTH_EXPIRED') Alert.alert('识别失败', error.message);
      }).finally(() => {
        setTimeout(() => {
          scanLockRef.current = false;
        }, 800);
      });
    },
    [handleScannedText]
  );

  const openScanner = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('提示', '网页版暂不支持调用摄像头，请使用「从相册选择」');
      return;
    }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res?.granted) {
        Alert.alert('没有相机权限', '请在系统设置中允许简校园使用相机');
        return;
      }
    }
    scanLockRef.current = false;
    setScanning(true);
  }, [permission, requestPermission]);

  const pickFromGallery = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('没有相册权限', '请在系统设置中允许简校园访问相册');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (res.canceled || !res.assets?.length) return;
      if (Platform.OS === 'web') {
        Alert.alert('提示', '网页版暂不支持从图片识别二维码');
        return;
      }
      const results = await scanFromURLAsync(res.assets[0].uri, ['qr']);
      if (!results?.length) {
        Alert.alert('未识别到二维码', '请选择清晰的身份码截图');
        return;
      }
      await handleScannedText(results[0].data);
    } catch (error) {
      Alert.alert('识别失败', error?.message || '请稍后重试');
    }
  }, [handleScannedText]);

  const handleImportFile = useCallback(async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const text = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const users = parseUserJson(text);
      const merged = await mergeUserBook(users);
      setBook(merged);
      Alert.alert('导入成功', `识别到 ${users.length} 个用户，当前共 ${merged.length} 个`);
    } catch (error) {
      Alert.alert('导入失败', error?.message || '文件读取失败');
    }
  }, []);

  const handlePasteImport = useCallback(async () => {
    try {
      const users = parseUserJson(pasteText);
      const merged = await mergeUserBook(users);
      setBook(merged);
      setPasteOpen(false);
      setPasteText('');
      Alert.alert('导入成功', `识别到 ${users.length} 个用户，当前共 ${merged.length} 个`);
    } catch (error) {
      Alert.alert('导入失败', error?.message || 'JSON 格式不正确');
    }
  }, [pasteText]);

  const handleClipboardImport = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      const users = parseUserJson(text);
      const merged = await mergeUserBook(users);
      setBook(merged);
      Alert.alert('导入成功', `识别到 ${users.length} 个用户，当前共 ${merged.length} 个`);
    } catch (error) {
      Alert.alert('剪贴板导入失败', error.message, [
        { text: '取消', style: 'cancel' },
        { text: '手动粘贴', onPress: () => setPasteOpen(true) },
      ]);
    }
  }, []);

  const handleAddSelf = useCallback(async () => {
    if (!currentUser) return;
    try {
      const merged = await mergeUserBook([currentUser]);
      setBook(merged);
      Alert.alert('已加入', `${currentUser.realname || currentUser.username} 已加入用户库`);
    } catch (error) {
      Alert.alert('保存失败', error.message);
    }
  }, [currentUser]);

  const handleRemove = useCallback((user) => {
    Alert.alert('移除用户', `确定从用户库移除 ${user.realname || user.username || user.id}？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '移除',
        style: 'destructive',
        onPress: async () => {
          try {
            const next = await removeUserFromBook(user.id);
            setBook(next);
          } catch (error) {
            Alert.alert('移除失败', error.message);
          }
        },
      },
    ]);
  }, []);

  const handleExport = useCallback(async () => {
    const users = book.length ? book : currentUser ? [currentUser] : [];
    if (!users.length) {
      Alert.alert('提示', '用户库为空');
      return;
    }
    try {
      await shareUsers(users);
    } catch (error) {
      Alert.alert('导出失败', error?.message || '请稍后重试');
    }
  }, [book, currentUser]);

  const topPadding = Math.max(headerHeight, insets.top + 12) + 8;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 活动 + 模式 */}
        <View style={styles.card}>
          <GlassFill radius={22} />
          <Text style={styles.cardTitle}>签到设置</Text>

          <TouchableOpacity
            style={styles.selector}
            activeOpacity={0.7}
            onPress={() => setActivityPicker(true)}
          >
            <View style={styles.selectorLeft}>
              <Ionicons name="calendar-outline" size={18} color="#2ecc71" />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={styles.selectorLabel}>活动</Text>
                <Text style={styles.selectorValue} numberOfLines={1}>
                  {selectedActivity ? selectedActivity.name : loadingActivities ? '加载中…' : '请选择活动'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#b2c0c6" />
          </TouchableOpacity>

          <View style={styles.modeRow}>
            {MODES.map((item) => {
              const active = item.key === mode;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.modeBtn, active && styles.modeBtnActive]}
                  onPress={() => setMode(item.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.modeText, active && styles.modeTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.primaryBtn} onPress={openScanner} activeOpacity={0.85}>
              <Ionicons name="qr-code-outline" size={20} color="white" />
              <Text style={styles.primaryBtnText}>扫码{ mode === 'out' ? '签退' : '签到'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={pickFromGallery} activeOpacity={0.85}>
              <Ionicons name="image-outline" size={20} color="#2ecc71" />
              <Text style={styles.secondaryBtnText}>相册识别</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>
            扫码支持摄像头与相册截图；二维码有效期 30 秒。
          </Text>
        </View>

        {/* 用户库 */}
        <View style={styles.card}>
          <GlassFill radius={22} />
          <View style={styles.bookHeader}>
            <Text style={styles.cardTitle}>用户库 · {book.length}</Text>
            <TouchableOpacity style={styles.smallBtn} onPress={handleExport} activeOpacity={0.8}>
              <Ionicons name="share-outline" size={15} color="#2ecc71" />
              <Text style={styles.smallBtnText}>导出</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.importRow}>
            <TouchableOpacity style={styles.importBtn} onPress={handleImportFile} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={16} color="#3498db" />
              <Text style={styles.importText}>导入 JSON 文件</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.importBtn} onPress={handleClipboardImport} activeOpacity={0.8}>
              <Ionicons name="clipboard-outline" size={16} color="#9b59b6" />
              <Text style={styles.importText}>从剪贴板导入</Text>
            </TouchableOpacity>
          </View>

          {currentUser ? (
            <TouchableOpacity style={styles.selfRow} onPress={handleAddSelf} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={16} color="#e67e22" />
              <Text style={styles.selfText}>
                把当前账号（{currentUser.realname || currentUser.username}）加入用户库
              </Text>
            </TouchableOpacity>
          ) : null}

          {book.length === 0 ? (
            <Text style={styles.emptyText}>
              还没有用户。让对方在「我的 → 导出我的信息」分享 JSON，然后在这里导入。
            </Text>
          ) : (
            book.map((user) => (
              <View key={user.id} style={styles.userRow}>
                <TouchableOpacity
                  style={styles.userMain}
                  onPress={() => setQrUser(user)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(user.realname || user.username || '?').slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.userName}>
                      {user.realname || '未填写姓名'}
                    </Text>
                    <Text style={styles.userSub}>
                      {user.username ? `学号 ${user.username}` : '无学号'} · ID {user.id}
                    </Text>
                  </View>
                  <Ionicons name="qr-code-outline" size={18} color="#2ecc71" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemove(user)}>
                  <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footerHint}>
          选择已保存的用户后，可为其签到或签退。操作结果以服务端返回为准。
        </Text>
      </ScrollView>

      {/* 活动选择 */}
      <Modal visible={activityPicker} transparent animationType="fade" onRequestClose={() => setActivityPicker(false)}>
        <Pressable style={styles.modalMask} onPress={() => setActivityPicker(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>选择活动</Text>
            {loadingActivities ? (
              <ActivityIndicator color="#2ecc71" style={{ marginVertical: 24 }} />
            ) : activities.length === 0 ? (
              <Text style={styles.emptyText}>
                当前账号没有可签到的活动。只有活动签到员 / 管理员才能在这里看到活动。
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 420 }}>
                {activities.map((item) => {
                  const active = String(item.id) === String(activityId);
                  return (
                    <TouchableOpacity
                      key={String(item.id)}
                      style={[styles.activityItem, active && styles.activityItemActive]}
                      onPress={() => {
                        setActivityId(item.id);
                        setActivityPicker(false);
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.activityName} numberOfLines={2}>{item.name}</Text>
                        <Text style={styles.activityTime}>{fmtActivity(item)}</Text>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={20} color="#2ecc71" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 用户二维码 + 代签到 */}
      <Modal
        visible={!!qrUser}
        transparent
        animationType="fade"
        onRequestClose={() => setQrUser(null)}
      >
        <Pressable style={styles.modalMask} onPress={() => setQrUser(null)}>
          <Pressable style={styles.qrSheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>代签到</Text>
            <Text style={styles.qrWho}>
              {qrUser?.realname || '未填写姓名'}
              {qrUser?.username ? ` · ${qrUser.username}` : ''}
            </Text>

            <View style={styles.qrBox}>
              {qrValue ? (
                <QRCode value={qrValue} size={220} color="#20323a" backgroundColor="white" quietZone={8} />
              ) : (
                <View style={styles.qrLoading}>
                  <ActivityIndicator color="#2ecc71" />
                </View>
              )}
            </View>
            <Text style={styles.qrTimer}>{qrLeft} 秒后刷新</Text>

            <View style={styles.qrActions}>
              <TouchableOpacity
                style={[styles.qrActionBtn, { backgroundColor: '#2ecc71' }]}
                disabled={busy}
                onPress={() => {
                  if (!qrUser) return;
                  Alert.alert('确认签到', `确定为 ${qrUser.realname || qrUser.username || qrUser.id} 签到？`, [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '确认',
                      onPress: () =>
                        submitSign({
                          mid: qrUser.id,
                          signMode: 'in',
                          label: qrUser.realname || qrUser.username || qrUser.id,
                        }),
                    },
                  ]);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.qrActionText}>代签到</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.qrActionBtn, { backgroundColor: '#3498db' }]}
                disabled={busy}
                onPress={() => {
                  if (!qrUser) return;
                  Alert.alert('确认签退', `确定为 ${qrUser.realname || qrUser.username || qrUser.id} 签退？`, [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '确认',
                      onPress: () =>
                        submitSign({
                          mid: qrUser.id,
                          signMode: 'out',
                          label: qrUser.realname || qrUser.username || qrUser.id,
                        }),
                    },
                  ]);
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.qrActionText}>代签退</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={() => setQrUser(null)}>
              <Text style={styles.closeBtnText}>关闭</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 粘贴 JSON */}
      <Modal visible={pasteOpen} transparent animationType="fade" onRequestClose={() => setPasteOpen(false)}>
        <Pressable style={styles.modalMask} onPress={() => setPasteOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>粘贴用户 JSON</Text>
            <Text style={styles.pasteHint}>
              支持 {"{ users: [...] }"}、数组，或单个用户对象。至少包含 id。
            </Text>
            <TextInput
              style={styles.pasteInput}
              multiline
              value={pasteText}
              onChangeText={setPasteText}
              placeholder='{"users":[{"id":"123","username":"S001","fullProfile":{"realname":"示例用户"}}]}'
              placeholderTextColor="#b2c0c6"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.pasteActions}>
              <TouchableOpacity style={styles.pasteCancel} onPress={() => setPasteOpen(false)}>
                <Text style={styles.pasteCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pasteOk} onPress={handlePasteImport}>
                <Text style={styles.pasteOkText}>导入</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 摄像头扫码 */}
      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={handleBarcode}
          />
          <View style={styles.scanOverlay}>
            <View style={styles.scanFrame} />
            <Text style={styles.scanTip}>
              对准对方的身份码 · 当前{mode === 'out' ? '签退' : '签到'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.scanClose, { top: insets.top + 16 }]}
            onPress={() => setScanning(false)}
          >
            <Ionicons name="close" size={26} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7f6' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: {
    backgroundColor: nativeGlass ? 'rgba(255,255,255,0.5)' : 'white',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#20323a' },
  selector: {
    marginTop: 14,
    backgroundColor: '#f4f8f7',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  selectorLabel: { fontSize: 11, color: '#92a2a9', marginBottom: 2 },
  selectorValue: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: '#eaf1ef',
    borderRadius: 14,
    padding: 4,
    marginTop: 14,
  },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 11 },
  modeBtnActive: { backgroundColor: 'white' },
  modeText: { fontSize: 14, fontWeight: '600', color: '#799097' },
  modeTextActive: { color: '#20323a' },
  actionRow: { flexDirection: 'row', marginTop: 14, gap: 10 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#2ecc71',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  primaryBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#e8f8f0',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryBtnText: { color: '#27ae60', fontSize: 15, fontWeight: '800' },
  hint: { marginTop: 10, fontSize: 11, color: '#92a2a9', lineHeight: 17 },
  bookHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e8f8f0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallBtnText: { color: '#27ae60', fontSize: 12, fontWeight: '700' },
  importRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#f4f8f7',
    borderRadius: 14,
    paddingVertical: 12,
  },
  importText: { fontSize: 12, fontWeight: '700', color: '#34495e' },
  selfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 2,
  },
  selfText: { fontSize: 12, color: '#e67e22', fontWeight: '600', flex: 1 },
  emptyText: { fontSize: 12, color: '#92a2a9', lineHeight: 19, marginTop: 14 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eef3f1',
    marginTop: 12,
    paddingTop: 12,
  },
  userMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#e8f8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#27ae60', fontWeight: '800', fontSize: 16 },
  userName: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  userSub: { fontSize: 11, color: '#92a2a9', marginTop: 3 },
  removeBtn: { padding: 8 },
  footerHint: { fontSize: 11, color: '#a6b4ba', textAlign: 'center', lineHeight: 17 },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(15,28,33,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 18,
    maxHeight: '85%',
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#20323a', textAlign: 'center', marginBottom: 12 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: '#f6f9f8',
  },
  activityItemActive: { backgroundColor: '#e8f8f0' },
  activityName: { fontSize: 14, fontWeight: '700', color: '#2c3e50' },
  activityTime: { fontSize: 11, color: '#92a2a9', marginTop: 4 },
  qrSheet: { backgroundColor: 'white', borderRadius: 24, padding: 20, alignItems: 'center' },
  qrWho: { fontSize: 13, color: '#7f8c8d', marginTop: -4, marginBottom: 12 },
  qrBox: {
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eef3f1',
    backgroundColor: 'white',
  },
  qrLoading: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  qrTimer: { fontSize: 12, color: '#92a2a9', marginTop: 10 },
  qrActions: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  qrActionBtn: { flex: 1, borderRadius: 15, paddingVertical: 14, alignItems: 'center' },
  qrActionText: { color: 'white', fontSize: 15, fontWeight: '800' },
  closeBtn: { marginTop: 12, paddingVertical: 10, alignSelf: 'stretch', alignItems: 'center' },
  closeBtnText: { color: '#92a2a9', fontSize: 14, fontWeight: '600' },
  pasteHint: { fontSize: 11, color: '#92a2a9', marginBottom: 10, lineHeight: 17 },
  pasteInput: {
    minHeight: 150,
    maxHeight: 260,
    backgroundColor: '#f4f8f7',
    borderRadius: 14,
    padding: 12,
    fontSize: 12,
    color: '#2c3e50',
    textAlignVertical: 'top',
  },
  pasteActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pasteCancel: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#f1f4f3',
  },
  pasteCancelText: { color: '#7f8c8d', fontSize: 14, fontWeight: '700' },
  pasteOk: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#2ecc71',
  },
  pasteOkText: { color: 'white', fontSize: 14, fontWeight: '800' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 250,
    height: 250,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(46,204,113,0.9)',
    backgroundColor: 'transparent',
  },
  scanTip: { color: 'white', fontSize: 14, marginTop: 22, fontWeight: '600' },
  scanClose: {
    position: 'absolute',
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
