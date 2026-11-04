// 本地用户库：导出 / 导入 / 去重
// 导出格式（不含 token / oauth，避免泄露）：
// {
//   "app": "simpleuniversity",
//   "version": 1,
//   "exportedAt": "2026-11-04T...",
//   "users": [
//     { "id": "123", "username": "S001", "fullProfile": { "realname": "示例用户" } }
//   ]
// }

import AsyncStorage from '@react-native-async-storage/async-storage';

export const USER_BOOK_KEY = 'pu_user_book';

function pickRealname(raw) {
  return (
    raw?.fullProfile?.realname ||
    raw?.realname ||
    raw?.name ||
    raw?.nickname ||
    ''
  );
}

// 兼容多种来源：user_data、{users:[]}、单个用户对象
export function normalizeUser(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const base = raw.baseUserInfo || raw.userInfo || raw.user || raw;
  const id = base?.id ?? base?.uid ?? base?.mid ?? raw.id ?? raw.uid ?? raw.mid;
  const username = base?.username ?? base?.account ?? raw.username ?? raw.account;
  const realname = pickRealname(raw) || pickRealname(base);

  if (id == null || String(id).trim() === '') return null;

  return {
    id: String(id),
    username: username == null ? '' : String(username),
    realname: realname ? String(realname) : '',
  };
}

// 从任意 JSON 文本解析出用户数组
export function parseUserJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error('JSON 格式不正确');
  }

  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (Array.isArray(data?.users)) {
    list = data.users;
  } else if (Array.isArray(data?.list)) {
    list = data.list;
  } else if (Array.isArray(data?.data)) {
    list = data.data;
  } else if (data && typeof data === 'object') {
    list = [data];
  }

  const out = [];
  const seen = new Set();
  for (const item of list) {
    const user = normalizeUser(item);
    if (user && !seen.has(user.id)) {
      seen.add(user.id);
      out.push(user);
    }
  }

  if (out.length === 0) {
    throw new Error('没有识别到有效的用户信息（需要 id）');
  }
  return out;
}

export function buildExportPayload(users) {
  const list = (users || [])
    .map(normalizeUser)
    .filter(Boolean)
    .map((user) => ({
      id: user.id,
      username: user.username,
      fullProfile: { realname: user.realname },
    }));

  return {
    app: 'simpleuniversity',
    version: 1,
    exportedAt: new Date().toISOString(),
    users: list,
  };
}

export async function loadUserBook() {
  try {
    const raw = await AsyncStorage.getItem(USER_BOOK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeUser).filter(Boolean) : [];
  } catch (error) {
    throw new Error(`读取本地用户库失败：${error.message}`);
  }
}

export async function saveUserBook(users) {
  const list = (users || []).map(normalizeUser).filter(Boolean);
  await AsyncStorage.setItem(USER_BOOK_KEY, JSON.stringify(list));
  return list;
}

export async function mergeUserBook(users) {
  const existing = await loadUserBook();
  const map = new Map(existing.map((user) => [user.id, user]));
  for (const user of users || []) {
    const normalized = normalizeUser(user);
    if (normalized) {
      map.set(normalized.id, { ...map.get(normalized.id), ...normalized });
    }
  }
  return saveUserBook(Array.from(map.values()));
}

export async function removeUserFromBook(id) {
  const existing = await loadUserBook();
  return saveUserBook(existing.filter((user) => user.id !== String(id)));
}
