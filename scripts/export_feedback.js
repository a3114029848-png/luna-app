/**
 * 反馈回流：把用户 👎 坏样本转成候选评测用例（数据飞轮：反馈 → 标注 → 改进）
 *
 * 用法：
 *   node scripts/export_feedback.js                        # 默认读 eval/feedback_export.example.json
 *   node scripts/export_feedback.js --in  eval/feedback_export.json --out eval/candidates.json
 *
 * 说明：
 *   - 输入结构 = feedbackStore.js 的保存格式（source: local|knowledge|safety|cloud, useful: boolean, text）
 *   - 只取 useful=false 的坏样本
 *   - 生成的是「候选 Case」：六要素中的输入与环境可自动补，但「必须做到/不能出现」需人工确认后
 *     才能并入 eval/eval_cases.json（避免把用户偶发不满直接当红线）
 *   - 隐私：text 已截断 80 字（feedbackStore 落库时已截断），脚本再脱敏（去消息 id）
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_IN = path.join(ROOT, 'eval/feedback_export.example.json');
const DEFAULT_OUT = path.join(ROOT, 'eval/candidates.json');

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = path.resolve(argv[++i]);
    else if (argv[i] === '--out') args.out = path.resolve(argv[++i]);
  }
  return args;
}

// 由 source 推断 risk / group（仅供候选标注，人工可改）
function inferMeta(source) {
  if (source === 'safety') return { group: 'B', risk: 'high' };
  if (source === 'knowledge') return { group: 'C', risk: 'low' };
  if (source === 'local') return { group: 'A', risk: 'low' };
  return { group: 'CAND', risk: 'low' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const items = JSON.parse(fs.readFileSync(args.in, 'utf8'));
  const bad = items.filter(x => x.useful === false);

  const candidates = bad.map((x, i) => {
    const { group, risk } = inferMeta(x.source);
    const input = (x.text || '').split('？')[0] || x.text; // 启发式：取第一问作为输入（需人工核对）
    return {
      id: `CAND-${String(i + 1).padStart(2, '0')}`,
      group,
      risk,
      title: `反馈坏样本（${x.source}）`,
      input,
      environment: { mode: 'full' },
      expect: {
        // ⚠️ 待人工补全：必须做到 / 不能出现 / 如何判断
        must_contain: [],
        must_not_contain: []
      },
      source: `用户 👎 反馈（feedbackStore，脱敏）@ ${(x.createdAt || '').slice(0, 10)}`,
      version: 'candidate-v0',
      candidate: true,
    };
  });

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify({ meta: { note: '候选用例：人工确认 expect 后并入 eval_cases.json' }, cases: candidates }, null, 2), 'utf8');

  console.log(`读取 ${items.length} 条反馈，其中 👎 ${bad.length} 条 → 生成 ${candidates.length} 条候选（${path.relative(ROOT, args.out)}）`);
  if (!candidates.length) {
    console.log('没有坏样本，无需回流。');
    return 0;
  }
  console.log('下一步：人工补全每条候选的 expect（must_contain / must_not_contain / follow_up），再并入用例集。');
  return 0;
}

process.exit(main());
