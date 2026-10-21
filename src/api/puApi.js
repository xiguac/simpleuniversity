// PU口袋校园 API 辅助层
// 来源：官方 Web 端(class.pocketuni.net)与 app 内 H5(mobile.pocketuni.net/lesson) 已还原的请求构造逻辑

import CryptoJS from 'crypto-js';

// 官方 JS 中还原的 AES-128-CBC 密钥（psk 数组原样字节，两端一致）
const PSK_BYTES = [121, 121, 0, 19, 5, 49, 2, 43, 13, 17, 11, 9, 4, 29, 60, 11];

const ECHO_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function randomEcho() {
  let s = '';
  for (let i = 0; i < 16; i++) {
    s += ECHO_CHARS[Math.floor(Math.random() * ECHO_CHARS.length)];
  }
  return s;
}

// crypto-js 的 WordArray.random() 依赖原生 crypto.getRandomValues（RN 环境缺失），
// 这里用 Math.random 自行生成 IV 字节
function randomBytes(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

// X-Sign = base64( IV(16字节) || AES-128-CBC({echo,timestamp,client}) )
export function makeXSign(client = 'h5') {
  const signData = {
    echo: randomEcho(),
    timestamp: Math.floor(Date.now() / 1000).toString(),
    client,
  };
  return encryptPUSign(JSON.stringify(signData));
}

// 手工把字节数组构造成 CryptoJS WordArray（大端打包成 32-bit words），
// 避免 WordArray.create(Uint8Array) 在不同版本下行为不一致
function bytesToWordArray(bytes) {
  const words = [];
  for (let i = 0; i < bytes.length; i++) {
    const w = i >>> 2;
    words[w] = (words[w] || 0) | (bytes[i] << (24 - (i % 4) * 8));
  }
  return CryptoJS.lib.WordArray.create(words, bytes.length);
}

export function encryptPUSign(plain) {
  const key = bytesToWordArray(PSK_BYTES);
  const iv = bytesToWordArray(randomBytes(16));
  const encrypted = CryptoJS.AES.encrypt(plain, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // base64(IV || ciphertext)
  const combined = iv.clone();
  combined.concat(encrypted.ciphertext);
  return combined.toString(CryptoJS.enc.Base64);
}

// 统一构造带鉴权的请求头；needSign=true 时附带 X-Sign（报名 join 等写接口）
export function buildPuHeaders(token, sid, { needSign = false } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: 'https://class.pocketuni.net',
    Referer: 'https://class.pocketuni.net/',
    Authorization: `Bearer ${token}:${sid}`,
  };
  if (needSign) {
    headers['X-Sign'] = makeXSign('h5');
  }
  return headers;
}
