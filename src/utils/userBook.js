// 本地用户库：导出 / 导入 / 去重
// 导出格式（不含 token / oauth，避免泄露）：
// {
//   "app": "simpleuniversity",
//   "version": 2,
//   "exportedAt": "2026-11-04T...",
//   "users": [
//     { "id": "123", "username": "S001", "fullProfile": { "realname": "示例用户" } }
//   ],
//   "groups": [{ "name": "示例分组", "userIds": ["123"] }]
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

// 兼容旧版用户 JSON，并读取分组和成员归属
export function parseUserBookJson(text) {
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

  const groups = normalizeGroups(data?.groups, out);
  if (out.length === 0 && groups.length === 0) {
    throw new Error('没有识别到有效的用户信息（需要 id）');
  }
  return { users: out, groups };
}

export function parseUserJson(text) {
  return parseUserBookJson(text).users;
}

function normalizeGroups(groups, users) {
  const ids = new Set(users.map((user) => user.id));
  const byName = new Map();
  for (const group of Array.isArray(groups) ? groups : []) {
    if (typeof group?.name !== 'string' || !group.name.trim()) continue;
    const name = group.name.trim();
    const members = byName.get(name) || new Set();
    for (const id of Array.isArray(group.userIds) ? group.userIds : []) {
      if (ids.has(String(id))) members.add(String(id));
    }
    byName.set(name, members);
  }
  return Array.from(byName, ([name, members]) => ({ name, userIds: Array.from(members) }));
}

export function buildExportPayload(users, groups = []) {
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
    version: 2,
    exportedAt: new Date().toISOString(),
    users: list,
    groups: normalizeGroups(groups, list),
  };
}

export async function loadUserBookData() {
  try {
    const raw = await AsyncStorage.getItem(USER_BOOK_KEY);
    if (!raw) return { users: [], groups: [] };
    const parsed = JSON.parse(raw);
    const users = (Array.isArray(parsed) ? parsed : parsed.users || []).map(normalizeUser).filter(Boolean);
    return { users, groups: normalizeGroups(parsed.groups, users) };
  } catch (error) {
    throw new Error(`读取本地用户库失败：${error.message}`);
  }
}

export async function loadUserBook() {
  return (await loadUserBookData()).users;
}

export async function saveUserBook(users, groups) {
  const list = (users || []).map(normalizeUser).filter(Boolean);
  const savedGroups = groups ?? (await loadUserBookData()).groups;
  await AsyncStorage.setItem(USER_BOOK_KEY, JSON.stringify({ users: list, groups: normalizeGroups(savedGroups, list) }));
  return list;
}

export async function saveUserGroups(groups) {
  const { users } = await loadUserBookData();
  await saveUserBook(users, groups);
  return normalizeGroups(groups, users);
}

export async function mergeUserBook(users, groups = []) {
  const { users: existing, groups: existingGroups } = await loadUserBookData();
  const map = new Map(existing.map((user) => [user.id, user]));
  for (const user of users || []) {
    const normalized = normalizeUser(user);
    if (normalized) {
      map.set(normalized.id, { ...map.get(normalized.id), ...normalized });
    }
  }
  return saveUserBook(Array.from(map.values()), [...existingGroups, ...groups]);
}

export async function removeUserFromBook(id) {
  const existing = await loadUserBook();
  return saveUserBook(existing.filter((user) => user.id !== String(id)));
}
