/**
 * Luna 用户资料存储（AsyncStorage）
 * 遵循数据最小化：仅存昵称、出生年、平均周期等本地偏好，不收集可识别身份信息。
 */

// RN AsyncStorage；Node 环境自动降级为内存 mock
let AsyncStorage = null;
try {
  // eslint-disable-next-line global-require
  const mod = require('@react-native-async-storage/async-storage');
  // Metro/Babel default interop：必须取 default，避免拿到 { default: ... } 结构导致 getItem/setItem undefined
  AsyncStorage = (mod && mod.default) ? mod.default : mod;
} catch (err) {
  AsyncStorage = { getItem: async () => null, setItem: async () => {} };
}

const KEY = '@luna_user';

// 安全访问：AsyncStorage 不可用时返回 null，绝不抛出（避免 loadUser 覆盖内存缓存）
const safeGetItem = async () => (
  AsyncStorage && typeof AsyncStorage.getItem === 'function' ? AsyncStorage.getItem(KEY) : null
);
const safeSetItem = async (val) => {
  if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
    await AsyncStorage.setItem(KEY, val);
  }
};

// 内存缓存（同步读）
let _cache = { nickname: '', birthYear: '', avgCycle: 28 };

export async function loadUser() {
  try {
    const raw = await safeGetItem();
    if (raw) _cache = { ..._cache, ...JSON.parse(raw) };
  } catch (err) {
    /* 保持默认 */
  }
  return _cache;
}

export async function saveUser(partial) {
  _cache = { ..._cache, ...partial };
  try {
    await safeSetItem(JSON.stringify(_cache));
  } catch (err) {
    /* 写入失败静默（内存仍可用） */
  }
  return _cache;
}

export function getUser() {
  return _cache;
}

// ── 设备级匿名用户 ID（云同步数据隔离）──
// 每台设备首次启动生成随机 ID（不采集任何身份信息），用于后端 records 按 userId 隔离。
const DEVICE_ID_KEY = '@luna_device_id';

export async function getDeviceUserId() {
  let id = null;
  try {
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    }
  } catch (err) { /* ignore */ }
  if (!id) {
    id = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    try {
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      }
    } catch (err) { /* ignore */ }
  }
  return id;
}
