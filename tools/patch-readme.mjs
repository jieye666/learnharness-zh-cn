import fs from 'node:fs';

const P = 'README.md';
let s = fs.readFileSync(P, 'utf8');

// 1) 词表条数
s = s.replace('词表 **1182 条**', '词表 **1196 条**');

// 2) 修掉 PowerShell 安装命令里丢失的反斜杠
s = s.replace(
	'git clone https://github.com/jieye666/learnharness-zh-cn "$env:APPDATALearnHarnessdatapluginszh-cn-language-pack"',
	'git clone https://github.com/jieye666/learnharness-zh-cn "$env:APPDATA\\LearnHarness\\data\\plugins\\zh-cn-language-pack"'
);

// 3) 工具清单补两项
s = s.replace(
	'tools/merge-extras.mjs      合并 sources/*.json，冲突会打印出来让人裁决',
	[
		'tools/merge-extras.mjs      合并 sources/*.json，冲突会打印出来让人裁决',
		'tools/e2e-headless.mjs      无头端到端测试：起服务 + headless Chrome 逐个打开设置分区，报英文残留',
		'tools/scan-e2e-out.mjs      把上一步抓下来的文本里「词表没收录的英文行」列出来',
	].join('\n')
);

// 4) 用法补一条
s = s.replace(
	'node tools/check-jsx-text.mjs         # 确认没有漏网的可见文案',
	[
		'node tools/check-jsx-text.mjs         # 确认没有漏网的可见文案',
		'node tools/e2e-headless.mjs           # 无头跑一遍真实界面（不需要弹窗口、不动鼠标）',
	].join('\n')
);

// 5) 新增「无头端到端测试」小节，插在「覆盖情况」之前
const headless = `## 无头端到端测试

弹窗口截图靠不住（DPI 缩放、抢不到焦点、点错位置）。本仓库改为无头验证：` + '`node tools/e2e-headless.mjs`' + `

它做四件事：

1. 用 \`node server.js\` 起一个独立应用服务（随机/指定端口，数据目录指向本机 LearnHarness 的 \`data\`，所以插件是启用状态）；
2. 用 headless Chrome（\`puppeteer-core\` + 本机 Chrome，不下载浏览器）打开界面；
3. 点侧边栏「设置」，然后逐个点开 **服务商 / 智能体 / 外观 / 图谱 / 快捷键 / 通用 / 核心插件 / 社区插件 / 编程题 / 绘图板 / 闪卡 / 富文本代码块**，把每页文本抓下来存到 \`tools/e2e-out/*.txt\`；
4. 用白名单（品牌名、主题名、字体名、按键名、路径）过滤后，报每页还剩哪些英文，退出码 0 = 干净、2 = 有残留。

\`\`\`
node tools/e2e-headless.mjs                 # 全量检查
node tools/e2e-headless.mjs --keep          # 不杀服务进程（调试用）
node tools/e2e-headless.mjs --screenshot out.png
node tools/scan-e2e-out.mjs                 # 列出抓下来的文本里未收录的英文行
\`\`\`

当前结果：11 个分区全部通过（无英文残留）。这套测试是补译的主力 —— 它一上线就抓到 5 类点击截图发现不了的漏译：插件卡片 \`1.2.2 · Enabled\`、核心插件设置页三个开关标签、快捷键分组名、外观页的 \`COLORS / DARK / LIGHT / Empty = #…\`、智能体页的 \`Used by Teacher and Prober\`。

`;
s = s.replace('## 覆盖情况（0.6.1 源码实测）', headless + '## 覆盖情况（0.6.1 源码实测）');

// 6) 覆盖情况补一条无头结论
s = s.replace(
	'- JSX 属性位置 256 处英文：仅剩 ChatGPT、Claude Code 两个品牌名。',
	[
		'- JSX 属性位置 256 处英文：仅剩 ChatGPT、Claude Code 两个品牌名。',
		'- 无头 e2e（headless Chrome 真实渲染）：设置全部 11 个分区无英文残留。',
	].join('\n')
);

fs.writeFileSync(P, s, 'utf8');
console.log('README 更新完成');
