// PU 新版 API 辅助层（签到 / 身份码 / 实践学分）
// 依据：APK 7.1.91 内存脱壳代码 + 官方 myScore H5
// 详见 D:\pu\out\REPORT_sign_credit.md

import CryptoJS from 'crypto-js';
import { buildPuHeaders } from './puApi';

export const PU_API = 'https://apis.pocketuni.net';

// 身份码 DES key：完整常量前 8 字节（com.pu.common.utils.DesUtil）
const DES_KEY = CryptoJS.enc.Utf8.parse('TG123!@#');

// 二维码有效期（秒），与服务端 /apis/system/time 对齐
export const QR_TTL_SECONDS = 10;

export function desEncrypt(plain) {
  const encrypted = CryptoJS.DES.encrypt(plain, DES_KEY, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}

export function desDecrypt(cipher) {
  try {
    const decrypted = CryptoJS.DES.decrypt(cipher, DES_KEY, {
      mode: CryptoJS.mode.ECB,
      padding: CryptoJS.pad.Pkcs7,
    });
    const text = decrypted.toString(CryptoJS.enc.Utf8);
    return text || null;
  } catch (error) {
    return null;
  }
}

// 生成身份码明文：xyhui://user/{id}/{秒级时间}/{username}
export function buildUserQrPlain(id, timestamp, username) {
  return `xyhui://user/${id}/${timestamp}/${username}`;
}

// 解析扫码内容：兼容明文 xyhui:// 与 DES+Base64 两种形式
// 返回 { kind: 'user'|'activity', id, timestamp, username, plain }
export function parseQrPayload(raw) {
  if (!raw) return null;
  let text = String(raw).trim();
  if (!text.startsWith('xyhui://')) {
    const decrypted = desDecrypt(text);
    if (decrypted) text = decrypted.trim();
  }
  if (!text.startsWith('xyhui://')) return null;

  const match = text.match(/^xyhui:\/\/([a-z]+)\/([0-9a-zA-Z]+)\/?([^/]*)\/?([^/]*)/);
  if (!match) return null;

  return {
    kind: match[1],
    id: match[2],
    timestamp: match[3] || '',
    username: match[4] || '',
    plain: text,
  };
}

// 服务器秒级时间：新版 /apis/system/time → 旧版 sitelist/getTimestamp → 本机时间
export async function fetchServerTimeSeconds(authFetchJson, token, sid) {
  try {
    const json = await authFetchJson(`${PU_API}/apis/system/time`, {
      method: 'GET',
      headers: buildPuHeaders(token, sid),
    });
    const raw = json?.data?.timestamp ?? json?.timestamp;
    const num = Number(raw);
    if (Number.isFinite(num) && num > 0) {
      return num > 1e12 ? Math.floor(num / 1000) : Math.floor(num);
    }
  } catch (error) {
    if (error.code === 'AUTH_EXPIRED') throw error;
    console.warn('服务器时间获取失败，尝试备用接口', error);
  }

  try {
    const json = await authFetchJson(
      'https://pocketuni.net/index.php?app=api&mod=sitelist&act=getTimestamp',
      { method: 'GET' }
    );
    const num = Number(json?.timestamp);
    if (Number.isFinite(num) && num > 0) {
      return num > 1e12 ? Math.floor(num / 1000) : Math.floor(num);
    }
  } catch (error) {
    if (error.code === 'AUTH_EXPIRED') throw error;
    console.warn('备用时间接口失败，使用本机时间', error);
  }

  return Math.floor(Date.now() / 1000);
}

export function isQrFresh(qrTimestamp, serverTimestamp, ttl = QR_TTL_SECONDS) {
  const qr = Number(qrTimestamp);
  const now = Number(serverTimestamp);
  if (!Number.isFinite(qr) || !Number.isFinite(now)) return false;
  // 与官方 ScanActivity 一致：只允许服务端时间略大于二维码时间，且不超过 ttl 秒
  return Math.abs(now) - Math.abs(qr) <= ttl;
}

// 可签到活动列表（签到员权限）
export async function fetchCanSignList(authFetchJson, token, sid) {
  const json = await authFetchJson(`${PU_API}/apis/activity/canSignList`, {
    method: 'GET',
    headers: buildPuHeaders(token, sid),
  });
  if (json?.code !== 0) {
    throw new Error(json?.message || '获取可签到活动失败');
  }
  return json?.data?.list ?? [];
}

// 扫码签到 / 签退：body { activityId, mid }
export async function staffSign(authFetchJson, token, sid, { activityId, mid, mode }) {
  const action = mode === 'out' ? 'signOut' : 'signIn';
  return authFetchJson(`${PU_API}/apis/activity/${action}`, {
    method: 'POST',
    headers: buildPuHeaders(token, sid),
    body: JSON.stringify({
      activityId: Number(activityId),
      mid: Number(mid),
    }),
  });
}

export async function fetchActivityDetail(authFetchJson, token, sid, activityId) {
  return authFetchJson(`${PU_API}/apis/activity/info`, {
    method: 'POST',
    headers: buildPuHeaders(token, sid),
    body: JSON.stringify({ id: activityId }),
  });
}

// ---------- 实践学分 ----------

export async function fetchCreditIndex(authFetchJson, token, sid, year = 0) {
  return authFetchJson(`${PU_API}/apis/credit/index?year=${encodeURIComponent(year)}`, {
    method: 'GET',
    headers: buildPuHeaders(token, sid),
  });
}

export async function fetchCreditCategory(authFetchJson, token, sid, kind, year = 0) {
  const path = kind === 'apply' ? 'apply' : 'activity';
  return authFetchJson(`${PU_API}/apis/credit/${path}?year=${encodeURIComponent(year)}`, {
    method: 'GET',
    headers: buildPuHeaders(token, sid),
  });
}

export async function fetchCreditRecords(
  authFetchJson,
  token,
  sid,
  { kind = 'activity', type = 1, page = 1, limit = 20, ids = [], year = 0 } = {}
) {
  const path = kind === 'apply' ? 'applyList' : 'activityList';
  return authFetchJson(`${PU_API}/apis/credit/${path}`, {
    method: 'POST',
    headers: buildPuHeaders(token, sid),
    body: JSON.stringify({
      type,
      page,
      limit,
      ids,
      year: Number(year),
      puType: 0,
    }),
  });
}

export async function fetchCreditYears(authFetchJson, token, sid) {
  return authFetchJson(`${PU_API}/apis/mapping/year-list`, {
    method: 'GET',
    headers: buildPuHeaders(token, sid),
  });
}
