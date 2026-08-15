/**
 * dsh-offpeak preview-page generator.
 *
 * Renders pixel-faithful preview pages from the REAL plugin stylesheet:
 * the CSS is extracted from `src/client/styles.ts` (the single source of
 * truth), then the pages are screenshotted with headless Chrome into
 * `docs/screenshots/`. Keeping the previews generated from source means the
 * screenshots can never drift from the shipped UI.
 *
 * Usage:
 *   node scripts/generate-preview.mjs [--out docs/preview]
 *
 * Then, to capture screenshots:
 *   CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
 *   "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
 *     --window-size=900,220 --virtual-time-budget=1500 \
 *     --screenshot=docs/screenshots/pill-offpeak.png \
 *     file://$PWD/docs/preview/pill-offpeak.html
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] === '--out' && process.argv[3] ? join(root, process.argv[3]) : join(root, 'docs', 'preview')

/** Extract the CSS template string from src/client/styles.ts. */
function extractStyles() {
  const source = readFileSync(join(root, 'src', 'client', 'styles.ts'), 'utf8')
  const match = source.match(/const CSS = `([\s\S]*?)`\n/)
  if (match === null) throw new Error('could not locate the CSS template in src/client/styles.ts')
  return match[1]
}

/** Theme tokens (fallbacks from styles.ts) for the two preview surfaces. */
function themeCss(background, text, dim, caption, border, raised) {
  return `
.preview-theme {
  --dsw-alias-bg-base: ${raised};
  --dsw-alias-bg-layer: ${background};
  --dsw-alias-label-primary: ${text};
  --dsw-alias-label-dimmed: ${dim};
  --dsw-alias-label-caption: ${caption};
  --dsw-alias-border-l: ${border};
  --dsw-alias-brand-primary: #4d6bfe;
  --dsw-alias-interactive-bg-hover: ${border};
}
body { margin: 0; }
.preview-stage {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 28px;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
}
/* Force the hover tooltip open for screenshots. */
.preview-stage .dsh_offpeak_pill .dsh_offpeak_tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
`
}

/** One pill page: a pill (with open tooltip) on a themed stage. */
function pillPage(
  title, windowKind, multiplier, countdown, prices, savingsToday, pending,
  background, text, dim, caption, border, raised, labels,
) {
  const windowShort = windowKind === 'peak' ? labels.window : labels.window
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
${extractStyles()}
${themeCss(background, text, dim, caption, border, raised)}
</style>
</head>
<body class="preview-theme" style="background: ${background};">
  <div class="preview-stage">
    <div class="dsh_offpeak_pill" data-window="${windowKind}" role="status" tabindex="0">
      <span class="dsh_offpeak_pulse"><span class="dsh_offpeak_pulseRing"></span><span class="dsh_offpeak_pulseCore"></span></span>
      ${windowKind === 'peak'
        ? '<svg viewBox="0 0 16 16" class="dsh_offpeak_pillIcon" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor"/><g stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"/></g></svg>'
        : '<svg viewBox="0 0 16 16" class="dsh_offpeak_pillIcon" aria-hidden="true"><path d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.6 5.6 0 1 0 7 7Z" fill="currentColor"/></svg>'}
      <span class="dsh_offpeak_pillLabel">${windowShort}</span>
      <span class="dsh_offpeak_pillMultiplier">×${multiplier}</span>
      <span class="dsh_offpeak_pillCountdown">${countdown} 后切换${labels.nextWindow}</span>
      ${pending > 0 ? `<span class="dsh_offpeak_pillQueueBadge">${pending} 个待办</span>` : ''}
      <div class="dsh_offpeak_tooltip" role="tooltip">
        <div class="dsh_offpeak_tooltipTitle">
          <span>${windowShort} · ×${multiplier}</span>
          <span class="dsh_offpeak_tooltipSwitch">${labels.switchLine}</span>
        </div>
        <div class="dsh_offpeak_tooltipRow"><span class="dsh_offpeak_tooltipLabel">当前有效价格（每 1M tokens）</span><span></span></div>
        <div class="dsh_offpeak_tooltipRow"><span class="dsh_offpeak_tooltipLabel">${labels.input}</span><span class="dsh_offpeak_tooltipValue">$${prices.input}</span></div>
        <div class="dsh_offpeak_tooltipRow"><span class="dsh_offpeak_tooltipLabel">${labels.cacheHit}</span><span class="dsh_offpeak_tooltipValue">$${prices.cacheHit}</span></div>
        <div class="dsh_offpeak_tooltipRow"><span class="dsh_offpeak_tooltipLabel">${labels.output}</span><span class="dsh_offpeak_tooltipValue">$${prices.output}</span></div>
        <div class="dsh_offpeak_tooltipDivider"></div>
        <div class="dsh_offpeak_tooltipRow"><span class="dsh_offpeak_tooltipLabel">${labels.saved}</span><span class="dsh_offpeak_tooltipValue">${savingsToday}</span></div>
        <div class="dsh_offpeak_tooltipRow"><span class="dsh_offpeak_tooltipLabel">${labels.queue}</span><span class="dsh_offpeak_tooltipValue">${pending > 0 ? `${pending} ${labels.pendingLabel}` : '—'}</span></div>
      </div>
    </div>
  </div>
</body>
</html>`
}

/** The settings-section page (light theme, filled with sample data). */
function settingsPage() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>dsh-offpeak settings</title>
<style>
${extractStyles()}
${themeCss('#ffffff', '#1f2329', '#646a73', '#8a919c', 'rgba(31,35,41,0.12)', '#f7f8fa')}
</style>
</head>
<body class="preview-theme" style="background: #f2f3f5;">
  <div class="preview-stage" style="justify-content: center;">
    <div class="dsh_offpeak_section" style="max-width: 860px; width: 100%;">
      <div>
        <h2 class="dsh_offpeak_sectionTitle">错峰助手</h2>
        <p class="dsh_offpeak_sectionSubtitle">高峰/错峰计价感知、延迟队列与省钱账本。</p>
      </div>

      <label class="dsh_offpeak_toggle">
        <span class="dsh_offpeak_toggleText">
          <span class="dsh_offpeak_toggleLabel">启用错峰面板</span>
          <span class="dsh_offpeak_toggleDesc">显示计价浮标，并启用队列与账本。</span>
        </span>
        <input type="checkbox" checked>
        <span class="dsh_offpeak_switch" aria-hidden="true"></span>
      </label>

      <div class="dsh_offpeak_card">
        <h3 class="dsh_offpeak_cardTitle">计价</h3>
        <p class="dsh_offpeak_cardDesc">基础（错峰）价格，单位：USD / 1M tokens。高峰时段 DeepSeek 按倍率加倍。官方价格会调整，请以官方计价页为准并及时更新。</p>
        <div class="dsh_offpeak_form">
          <div class="dsh_offpeak_field">
            <span class="dsh_offpeak_fieldLabel">显示货币</span>
            <select class="dsh_offpeak_select"><option>美元（$）</option><option>人民币（¥）</option></select>
          </div>
          <div class="dsh_offpeak_field">
            <span class="dsh_offpeak_fieldLabel">输入价格（缓存未命中）</span>
            <input class="dsh_offpeak_input" value="0.28">
          </div>
          <div class="dsh_offpeak_field">
            <span class="dsh_offpeak_fieldLabel">缓存命中价格</span>
            <input class="dsh_offpeak_input" value="0.028">
          </div>
          <div class="dsh_offpeak_field">
            <span class="dsh_offpeak_fieldLabel">输出价格</span>
            <input class="dsh_offpeak_input" value="0.42">
          </div>
          <div class="dsh_offpeak_field">
            <span class="dsh_offpeak_fieldLabel">高峰倍率</span>
            <input class="dsh_offpeak_input" value="2">
            <span class="dsh_offpeak_fieldHint">高峰时段的价格倍率。官方值为 2。</span>
          </div>
          <div class="dsh_offpeak_field">
            <span class="dsh_offpeak_fieldLabel">显示时区（UTC 偏移，分钟）</span>
            <select class="dsh_offpeak_select"><option>UTC+8 (北京/Asia/Shanghai)</option></select>
            <span class="dsh_offpeak_fieldHint">仅用于展示切换时间，如 480 = UTC+8（北京时间）。</span>
          </div>
        </div>
      </div>

      <div class="dsh_offpeak_card">
        <h3 class="dsh_offpeak_cardTitle">错峰队列</h3>
        <p class="dsh_offpeak_cardDesc">通过 /defer 或 offpeak_defer 工具暂存的任务。</p>
        <div class="dsh_offpeak_queueList">
          <div class="dsh_offpeak_queueRow">
            <div class="dsh_offpeak_queueMain">
              <span class="dsh_offpeak_queueSummary">跑一遍完整回归测试（12 个模块）</span>
              <span class="dsh_offpeak_queueMeta">在高峰时段暂存 · $0.0821</span>
            </div>
            <span class="dsh_offpeak_chip dsh_offpeak_chipPending">待执行</span>
            <button class="dsh_offpeak_smallButton dsh_offpeak_smallButtonDanger">取消</button>
          </div>
          <div class="dsh_offpeak_queueRow">
            <div class="dsh_offpeak_queueMain">
              <span class="dsh_offpeak_queueSummary">批量生成文档站点（11 个页面）</span>
              <span class="dsh_offpeak_queueMeta">在高峰时段暂存 · $0.1530</span>
            </div>
            <span class="dsh_offpeak_chip dsh_offpeak_chipPending">待执行</span>
            <button class="dsh_offpeak_smallButton dsh_offpeak_smallButtonDanger">取消</button>
          </div>
          <div class="dsh_offpeak_queueRow">
            <div class="dsh_offpeak_queueMain">
              <span class="dsh_offpeak_queueSummary">夜间增量备份 + 校验</span>
              <span class="dsh_offpeak_queueMeta">在错峰时段暂存 · 已省 $0.0644</span>
            </div>
            <span class="dsh_offpeak_chip dsh_offpeak_chipDone">已完成</span>
          </div>
          <div class="dsh_offpeak_queueRow">
            <div class="dsh_offpeak_queueMain">
              <span class="dsh_offpeak_queueSummary">清理临时分支</span>
              <span class="dsh_offpeak_queueMeta">在高峰时段暂存</span>
            </div>
            <span class="dsh_offpeak_chip dsh_offpeak_chipCancelled">已取消</span>
          </div>
        </div>
      </div>

      <div class="dsh_offpeak_card">
        <h3 class="dsh_offpeak_cardTitle">省钱账本<button class="dsh_offpeak_smallButton dsh_offpeak_smallButtonDanger">清空账本</button></h3>
        <p class="dsh_offpeak_cardDesc">估算与暂存记录的追加日志。节省额为估算值，非计费数据。</p>
        <div class="dsh_offpeak_ledgerStats">
          <div class="dsh_offpeak_statCard"><div class="dsh_offpeak_statLabel">累计估算节省</div><div class="dsh_offpeak_statValue">$2.8471</div></div>
          <div class="dsh_offpeak_statCard"><div class="dsh_offpeak_statLabel">今日</div><div class="dsh_offpeak_statValue">$0.1832</div></div>
          <div class="dsh_offpeak_statCard"><div class="dsh_offpeak_statLabel">记录数</div><div class="dsh_offpeak_statValue">42</div></div>
        </div>
        <div class="dsh_offpeak_chart" role="img" aria-label="近 7 天节省">
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 62%"></div><span class="dsh_offpeak_chartDay">六</span></div>
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 41%"></div><span class="dsh_offpeak_chartDay">日</span></div>
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 88%"></div><span class="dsh_offpeak_chartDay">一</span></div>
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 55%"></div><span class="dsh_offpeak_chartDay">二</span></div>
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 100%"></div><span class="dsh_offpeak_chartDay">三</span></div>
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 30%"></div><span class="dsh_offpeak_chartDay">四</span></div>
          <div class="dsh_offpeak_chartBar"><div class="dsh_offpeak_chartFill" style="--dsh-offpeak-bar: 73%"></div><span class="dsh_offpeak_chartDay">五</span></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}

mkdirSync(outDir, { recursive: true })

const zh = {
  window: '高峰',
  nextWindow: '错峰',
  switchLine: '当前高峰，4h27m 后切换错峰',
  input: '输入',
  cacheHit: '缓存命中',
  output: '输出',
  saved: '今日已省',
  queue: '错峰队列',
  pendingLabel: '个待执行',
}

writeFileSync(join(outDir, 'pill-peak.html'), pillPage(
  'peak pill', 'peak', 2, '4h27m',
  { input: '0.56', cacheHit: '0.056', output: '0.84' },
  '$0.1832', 2,
  '#101318', '#e8eaed', '#9aa0a6', '#6b7280', 'rgba(232,234,237,0.14)', '#171c22',
  zh,
))

writeFileSync(join(outDir, 'pill-offpeak.html'), pillPage(
  'off-peak pill', 'offpeak', 1, '4h27m',
  { input: '0.28', cacheHit: '0.028', output: '0.42' },
  '$0.1832', 0,
  '#101318', '#e8eaed', '#9aa0a6', '#6b7280', 'rgba(232,234,237,0.14)', '#171c22',
  { ...zh, window: '错峰', nextWindow: '高峰', switchLine: '当前错峰，4h27m 后切换高峰' },
))

writeFileSync(join(outDir, 'settings.html'), settingsPage())

console.log(`preview pages written to ${outDir}`)
