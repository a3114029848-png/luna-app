/**
 * 轻量 UI 桥接：跨页面触发动作（如「日历 → 今日打开完整记录弹窗」）
 *
 * 用「模块级标志 + 页面 focus 消费」模式，避免引入全局状态库：
 *   - 发起方调用 requestOpenRecord()
 *   - 目标页在 useFocusEffect 里 consumeOpenRecord() 消费并执行动作
 */
let _pendingOpenRecord = false;

/** 请求打开「今日完整记录」弹窗（由今日页在聚焦时消费） */
export function requestOpenRecord() {
  _pendingOpenRecord = true;
}

/** 消费并清除标志；返回是否有待打开的请求 */
export function consumeOpenRecord() {
  const v = _pendingOpenRecord;
  _pendingOpenRecord = false;
  return v;
}
