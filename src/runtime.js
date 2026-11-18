/**
 * LearnHarness 简体中文语言包 —— 运行时
 *
 * 原理：LearnHarness 没有 i18n 层，界面文案是硬编码英文。
 * 这个插件被前端 import 进应用窗口后，遍历 DOM 文本节点与展示类属性
 * （placeholder / data-placeholder / aria-placeholder / title / aria-label / alt），
 * 用「英文原文 → 中文」的词表做整串替换，并用 MutationObserver 跟进后续渲染。
 *
 * 匹配优先级：
 * 1. 整串词表（trim 后完全相等）
 * 2. 带空白的片段词表（用于被 JSX 拆成多个文本节点的句子残片）
 * 3. 模板规则：词表 key 里含 {0} {1} 的条目编译成正则，处理版本号、数量等拼接文案
 * 4. 内置规则：相对时间（5m ago）、数量 + 名词（3 nodes）、纯名词补量词（nodes → 个节点）
 *
 * 安全性：
 * - 不做无锚点的子串替换，只匹配完整的节点文本或明确的片段槽位；
 * - 跳过 script / style / textarea / input / select / code / pre / kbd / contenteditable；
 * - 保留原文首尾空白，避免破坏行内排版。
 */

const DICT = __DICT__;

const SKIP_TAGS = new Set([
	'SCRIPT',
	'STYLE',
	'NOSCRIPT',
	'TEXTAREA',
	'INPUT',
	'SELECT',
	'OPTION',
	'CODE',
	'PRE',
	'KBD',
	'SAMP',
	'SVG',
	'MATH'
]);

const ATTRS = ['placeholder', 'data-placeholder', 'aria-placeholder', 'title', 'aria-label', 'alt'];

/** 数量 + 名词：整串形如「3 nodes」时用中文量词拼出来 */
const NOUNS = {
	node: '个节点',
	nodes: '个节点',
	chain: '条知识链',
	chains: '条知识链',
	session: '个会话',
	sessions: '个会话',
	source: '个来源',
	sources: '个来源',
	folder: '个文件夹',
	folders: '个文件夹',
	proposition: '个命题',
	propositions: '个命题',
	page: '页',
	pages: '页',
	model: '个模型',
	models: '个模型',
	message: '条消息',
	messages: '条消息',
	strand: '条线索',
	strands: '条线索',
	token: '个 token',
	tokens: '个 token',
	question: '道题',
	questions: '道题',
	card: '张卡片',
	cards: '张卡片',
	word: '个词',
	words: '个词',
	file: '个文件',
	files: '个文件',
	lesson: '节课',
	lessons: '节课',
	turn: '轮',
	turns: '轮',
	result: '条结果',
	results: '条结果',
	item: '项',
	items: '项',
	key: '个密钥',
	keys: '个密钥',
	edge: '条边',
	edges: '条边',
	chunk: '个分块',
	chunks: '个分块',
	char: '个字符',
	chars: '个字符',
	character: '个字符',
	characters: '个字符',
	agent: '个智能体',
	agents: '个智能体',
	tool: '个工具',
	tools: '个工具',
	plugin: '个插件',
	plugins: '个插件',
	line: '行',
	lines: '行',
	step: '步',
	steps: '步',
	attempt: '次尝试',
	attempts: '次尝试',
	second: '秒',
	seconds: '秒',
	minute: '分钟',
	minutes: '分钟',
	hour: '小时',
	hours: '小时',
	day: '天',
	days: '天'
};

/** 相对时间：just now / 5m ago / 3h ago / 2d ago */
const TIME_RULES = [
	{ re: /^(\d+)\s*m ago$/, to: (m) => `${m[1]} 分钟前` },
	{ re: /^(\d+)\s*h ago$/, to: (m) => `${m[1]} 小时前` },
	{ re: /^(\d+)\s*d ago$/, to: (m) => `${m[1]} 天前` }
];

const TOOL_NAMES = { research: '检索', demo: '演示', visual: '看图', pdf: 'PDF' };
const nounZh = (w) => NOUNS[w] ?? w;

/** 手写规则：整串形态固定、词表放不下的动态文案 */
function inner(text) {
	return DICT[text] ?? text;
}

const EXTRA_RULES = [
	{ re: /^Version (\d[\w.+-]*)$/, to: (m) => `版本 ${m[1]}` },
	{ re: /^Tool · ([a-z-]+)$/, to: (m) => `工具 · ${TOOL_NAMES[m[1]] ?? m[1]}` },
	{ re: /^Plan · (\d+) nodes?$/, to: (m) => `计划 · ${m[1]} 个节点` },
	{ re: /^Settings for (.+)$/, to: (m) => `${inner(m[1])}的设置` },
	{ re: /^Enable (.+)$/, to: (m) => `启用 ${inner(m[1])}` },
	{ re: /^Done picking — (\d[\d,]*)\s+([a-z]+) selected$/, to: (m) => `已选定，共 ${m[1]} ${nounZh(m[2])}` },
	{ re: /^(\d[\d,]*)\s+([a-z]+) selected$/, to: (m) => `已选中 ${m[1]} ${nounZh(m[2])}` },
	{ re: /^(\d[\d,]*)\s+([a-z]+) unextracted$/, to: (m) => `${m[1]} ${nounZh(m[2])}未提取` },
	{ re: /^read (\d+) pages?$/, to: (m) => `已读 ${m[1]} 页` },
	// Empty = #141414 / Empty = Source Sans 3
	{ re: /^Empty = (.+)$/, to: (m) => `空 = ${m[1]}` },
	// Used by Teacher and Prober / Used by Teacher, Prober and Practice
	{ re: /^Used by (.+)$/, to: (m) => {
		const { text, touched } = rolesZh(m[1]);
		return touched ? `被 ${text} 使用` : null;
	} },
	// 主题编辑器里 "名称 · dark · 决定下方所有颜色" 这类拼接串
	{ re: /^(.*?) · (dark|light) · (.*)$/, to: (m) => {
		const mode = m[2] === 'dark' ? '深色' : '浅色';
		return `${inner(m[1])} · ${mode} · ${inner(m[3])}`;
	} },
	{ re: /^(\d[\d,]*)\s+([a-z]+)$/, to: (m) => (NOUNS[m[2]] ? `${m[1]} ${NOUNS[m[2]]}` : null) },
];

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 把词表里含 {0} {1} 的条目编译成「正则 + 回填模板」 */
const PATTERNS = (() => {
	const out = [];
	for (const [key, value] of Object.entries(DICT)) {
		if (typeof value !== 'string' || !/\{\d+\}/.test(key)) continue;
		const order = [];
		const source = key.replace(/\{(\d+)\}/g, (_, d) => {
			order.push(Number(d));
			return '\u0000';
		});
		const re = new RegExp(
			'^' +
				source
					.split('\u0000')
					.map(escapeRe)
					.join('(.+?)') +
				'$'
		);
		out.push({ re, value, order });
	}
	// 长模板优先匹配，避免短模板抢走整句
	out.sort((a, b) => b.value.length - a.value.length);
	return out;
})();

function applyPattern(pattern, text) {
	const m = text.match(pattern.re);
	if (!m) return null;
	let out = pattern.value;
	pattern.order.forEach((slot, i) => {
		const captured = m[i + 1];
		// 英文复数后缀基本来自 `{n === 1 ? "" : "s"}` 这类三元，中文没有复数，直接吞掉
		const drop = /^(s|es|\(s\)|-s)$/.test(captured);
		out = out.split(`{${slot}}`).join(drop ? '' : captured);
	});
	out = out.replace(/([\u4e00-\u9fff])[sS](?![A-Za-z])/g, '$1');
	return /\{\d+\}/.test(out) ? null : out;
}

/** 片段词表：key 首尾若带空格，则只用于匹配带同样空白的文本节点 */
const FRAGMENTS = (() => {
	const out = new Map();
	for (const [key, value] of Object.entries(DICT)) {
		if (typeof value !== 'string') continue;
		if (key !== key.trim()) out.set(key, value);
	}
	return out;
})();

/** 角色/成员名，用于把 "Teacher and Prober" 这类拼串翻译出来 */
const ROLES = { Teacher: '老师', Prober: '探底器', Practice: '练习', Teaching: '教学' };

function rolesZh(text) {
	const parts = text.split(/\s*,\s*|\s+and\s+/).map(s => s.trim()).filter(Boolean);
	let touched = false;
	const out = parts.map(p => {
		if (ROLES[p]) { touched = true; return ROLES[p]; }
		const t = DICT[p];
		if (typeof t === 'string') { touched = true; return t; }
		return p;
	});
	return { text: out.join('、'), touched };
}

function translate(raw, depth = 0) {
	if (!raw) return null;
	const key = raw.trim();
	if (!key) return null;

	let value = DICT[key];
	if (typeof value === 'string' && value !== key) {
		const lead = raw.slice(0, raw.length - raw.trimStart().length);
		const trail = raw.slice(raw.trimEnd().length);
		return lead + value + trail;
	}

	// 片段（被 JSX 拆散的行内句子）
	const frag = FRAGMENTS.get(raw);
	if (typeof frag === 'string') return frag;

	for (const rule of EXTRA_RULES) {
		const m = key.match(rule.re);
		if (!m) continue;
		const res = rule.to(m);
		if (res === null) continue;
		const lead = raw.slice(0, raw.length - raw.trimStart().length);
		const trail = raw.slice(raw.trimEnd().length);
		return lead + res + trail;
	}

	for (const p of PATTERNS) {
		const res = applyPattern(p, key);
		if (res !== null) {
			const lead = raw.slice(0, raw.length - raw.trimStart().length);
			const trail = raw.slice(raw.trimEnd().length);
			return lead + res + trail;
		}
	}

	for (const rule of TIME_RULES) {
		const m = key.match(rule.re);
		if (m) return rule.to(m);
	}

	// 数量 + 名词：3 nodes → 3 个节点
	const counted = key.match(/^(\d[\d,]*)\s+([a-z][a-z ]*)$/);
	if (counted) {
		const noun = NOUNS[counted[2].trim()];
		if (noun) {
			const lead = raw.slice(0, raw.length - raw.trimStart().length);
			const trail = raw.slice(raw.trimEnd().length);
			return `${lead}${counted[1]} ${noun}${trail}`;
		}
	}

	// 分段翻译：「1.2.2 · Enabled」「COLORS · overrides on top of …」「Teaching · Practice」
	if (depth < 3 && key.includes(' · ')) {
		const parts = key.split(' · ');
		let touched = false;
		const out = parts.map(part => {
			const t = translate(part, depth + 1);
			if (typeof t === 'string' && t !== part) touched = true;
			return typeof t === 'string' ? t : part;
		});
		if (touched) {
			const lead = raw.slice(0, raw.length - raw.trimStart().length);
			const trail = raw.slice(raw.trimEnd().length);
			return lead + out.join(' · ') + trail;
		}
	}

	return null;
}

function skippable(el) {
	if (!el || el.nodeType !== 1) return false;
	if (SKIP_TAGS.has(el.tagName)) return true;
	if (el.isContentEditable) return true;
	if (el.hasAttribute('contenteditable')) return true;
	return false;
}

function skipAncestors(node) {
	let el = node.parentElement;
	while (el) {
		if (skippable(el)) return true;
		el = el.parentElement;
	}
	return false;
}

const undo = new Map();

/** 纯名词补量词：`{count} {count === 1 ? "node" : "nodes"}` 会把名词单独拆成一个文本节点 */
function translateBareNoun(node, raw) {
	const key = raw.trim();
	if (!NOUNS[key]) return null;
	const prev = node.previousSibling;
	const prevText = prev?.nodeValue ?? prev?.textContent ?? '';
	if (!/\d$/.test(prevText.trimEnd())) return null;
	const lead = raw.slice(0, raw.length - raw.trimStart().length);
	const trail = raw.slice(raw.trimEnd().length);
	return lead + NOUNS[key] + trail;
}

function doText(node) {
	if (skipAncestors(node)) return;
	const raw = node.nodeValue;
	let next = translate(raw);
	if (next === null) next = translateBareNoun(node, raw);
	if (next === null || next === raw) return;
	if (!undo.has(node)) undo.set(node, raw);
	node.nodeValue = next;
}

function doAttributes(el) {
	// 输入框的 placeholder 也要译，所以这里只避开自身是可编辑区，不看祖先
	if (!el || el.nodeType !== 1) return;
	// 可编辑区自己的 placeholder 属性也要译（文本内容不碰）
	if (SKIP_TAGS.has(el.tagName) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
	for (const name of ATTRS) {
		const raw = el.getAttribute?.(name);
		if (!raw) continue;
		const next = translate(raw);
		if (next === null || next === raw) continue;
		el.setAttribute(name, next);
	}
}

function walkAttributes(root) {
	if (!root?.querySelectorAll) return;
	for (const el of root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))) doAttributes(el);
}

function walk(root) {
	if (!root) return;
	if (root.nodeType === 3) {
		doText(root);
		return;
	}
	if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
	const element = root.nodeType === 1 ? root : null;
	if (element) {
		if (skippable(element)) return;
		doAttributes(element);
	}
	const doc = root.ownerDocument ?? document;
	const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			return skipAncestors(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
		}
	});
	const nodes = [];
	while (walker.nextNode()) nodes.push(walker.currentNode);
	for (const node of nodes) doText(node);
	walkAttributes(root);
}

function doTitle() {
	const raw = document.title;
	const next = translate(raw);
	if (next !== null && next !== raw) document.title = next;
}

export function activate() {
	walk(document.body);
	doTitle();

	// React 常在挂载后才写入 placeholder/title，单靠 MutationObserver 会漏，定期重扫属性
	const attrTimer = setInterval(() => walkAttributes(document.body), 1200);
	observerCleanup.push(() => clearInterval(attrTimer));

	const observer = new MutationObserver((records) => {
		for (const record of records) {
			if (record.type === 'characterData') doText(record.target);
			else if (record.type === 'attributes') doAttributes(record.target);
			else for (const node of record.addedNodes) walk(node);
		}
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
		characterData: true,
		attributes: true,
		attributeFilter: ATTRS
	});

	// 路由切换 / 窗口标题变化
	const titleEl = document.querySelector('title');
	if (titleEl) {
		const titleObserver = new MutationObserver(doTitle);
		titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
		observerCleanup.push(() => titleObserver.disconnect());
	}
	const onNav = () =>
		setTimeout(() => {
			walk(document.body);
			doTitle();
		}, 50);
	window.addEventListener('popstate', onNav);
	observerCleanup.push(() => window.removeEventListener('popstate', onNav));

	return () => {
		observer.disconnect();
		for (const off of observerCleanup.splice(0)) off();
		for (const [node, raw] of undo) {
			try {
				node.nodeValue = raw;
			} catch {
				/* 节点已卸载 */
			}
		}
		undo.clear();
	};
}

const observerCleanup = [];
