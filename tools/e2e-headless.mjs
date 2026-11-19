// 无头端到端测试：起 standalone server → headless Chrome 打开界面 → 逐个打开设置分区 → 抓文本 → 报英文残留
// 用法: node tools/e2e-headless.mjs [--port 39530] [--keep] [--screenshot out.png]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const APP = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone';
const DATA = 'C:/Users/LENOVO/AppData/Roaming/LearnHarness/data';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
	const i = argv.indexOf('--' + name);
	return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const PORT = Number(argOf('port', 39530));
const KEEP = argv.includes('--keep');
const SHOT = argOf('screenshot', '');

// 允许保留的英文（品牌、专有名词、格式名）
const ALLOW = [
	'Learning Harness', 'LearnHarness', 'ChatGPT', 'GitHub Copilot', 'Grok', 'Claude Code', 'Deepgram', 'Tavily',
	'Brave', 'Exa', 'Firecrawl', 'Ollama', 'OpenAI', 'API', 'JSON', 'Markdown', 'token', 'FSRS-6',
	'SMILES', 'ABC', 'TikZ', 'Anki', 'FSRS', 'key', 'off', 'v4.1', 'deepseek', 'HTML', 'CSS', 'SVG',
	// 界面里有意保留英文：主题名、字体名、角色名、按键名、路径片段
	'Catppuccin', 'Gruvbox', 'NvChad', 'Ivory', 'Pastel', 'Pine', 'Ros', 'Latte', 'Frapp',
	'Macchiato', 'Mocha', 'Onedark', 'Dawn', 'Source Sans', 'Aa ai', 'Member', 'Ctrl', 'Shift',
	'Alt', 'Meta', 'Space', 'Tab', 'Enter', 'Esc', 'Users', 'AppData', 'Roaming', 'LENOVO',
	'PDF', 'MD', 'CCO', 'smiles', 'abc', 'tikz',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitOk(url, tries = 90) {
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(url);
			if (res.ok) return true;
		} catch {}
		await sleep(1000);
	}
	return false;
}

function startServer() {
	const child = spawn(process.execPath, ['server.js'], {
		cwd: APP,
		env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', LH_DATA_DIR: DATA, NODE_ENV: 'production' },
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const log = [];
	child.stdout.on('data', d => log.push(String(d)));
	child.stderr.on('data', d => log.push(String(d)));
	return { child, log };
}

function suspicious(text) {
	const found = new Set();
	for (const m of text.matchAll(/[A-Za-z][A-Za-z'’.\-]*(?:\s+[A-Za-z][A-Za-z'’.\-]*){0,8}/g)) {
		let seg = m[0].trim();
		if (seg.length < 3) continue;
		if (!/[A-Za-z]{3,}/.test(seg)) continue;
		if (ALLOW.some(a => seg.includes(a))) continue;
		// 纯小写单词（如 key / off / model id）多半是标识符，但要保留可读性：只报 3 词以上或首字母大写
		const words = seg.split(/\s+/);
		if (words.length < 2 && !/^[A-Z]/.test(seg)) continue;
		found.add(seg);
	}
	return [...found];
}

const server = startServer();
const base = `http://127.0.0.1:${PORT}`;
let browser;
try {
	if (!(await waitOk(base + '/'))) throw new Error('server 未就绪: ' + server.log.join('').slice(-800));
	console.log('server ready on', base);

	browser = await puppeteer.launch({
		executablePath: CHROME,
		headless: true,
		args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900', '--lang=zh-CN'],
		defaultViewport: { width: 1440, height: 900 },
	});
	const page = await browser.newPage();
	const errors = [];
	page.on('pageerror', e => errors.push('pageerror: ' + e.message));
	page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
	page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

	await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 });
	await sleep(1500);

	// 侧边栏「设置」按钮
	const opened = await page.evaluate(() => {
		const btn = [...document.querySelectorAll('button,a')].find(el => (el.innerText || '').trim() === '设置');
		if (!btn) return false;
		btn.click();
		return true;
	});
	if (!opened) throw new Error('找不到「设置」入口');
	await sleep(1200);

	// 设置左侧导航项
	const sections = await page.evaluate(() => {
		const nav = [...document.querySelectorAll('button,a,[role="tab"],[role="button"]')];
		return [...new Set(nav.map(el => (el.innerText || '').trim()).filter(t => t && t.length < 20))];
	});
	console.log('导航项:', sections.join(' / '));

	const report = [];
	const visit = ['核心插件', '社区插件', '编程题', '绘图板', '闪卡', '富文本代码块', '通用', '快捷键', '外观', '智能体', '服务商'];
	for (const name of visit) {
		const clicked = await page.evaluate(n => {
			const el = [...document.querySelectorAll('button,a,[role="tab"],[role="button"]')]
				.find(e => (e.innerText || '').trim() === n);
			if (!el) return false;
			el.click();
			return true;
		}, name);
		if (!clicked) { report.push({ name, skipped: '导航里没有这一项' }); continue; }
		await sleep(900);
		const text = await page.evaluate(() => {
			const dialog = document.querySelector('[role="dialog"]') || document.body;
			return dialog.innerText || '';
		});
		fs.mkdirSync('tools/e2e-out', { recursive: true });
		fs.writeFileSync(path.join('tools/e2e-out', name + '.txt'), text, 'utf8');
		report.push({ name, len: text.length, suspicious: suspicious(text) });
	}

	if (SHOT) { await page.screenshot({ path: SHOT }); console.log('截图:', SHOT); }

	let bad = 0;
	for (const r of report) {
		if (r.skipped) { console.log(`- ${r.name}: 跳过（${r.skipped}）`); continue; }
		if (r.suspicious.length === 0) { console.log(`✅ ${r.name}: 无英文残留（${r.len} 字符）`); continue; }
		bad++;
		console.log(`⚠️ ${r.name}: ${r.suspicious.length} 处可疑英文`);
		for (const s of r.suspicious.slice(0, 12)) console.log('    ' + s);
	}
	if (errors.length) {
		console.log('页面错误', errors.length, '条:');
		for (const e of errors.slice(0, 8)) console.log('    ' + e);
	}
	console.log(bad === 0 ? '\n全部通过' : `\n${bad} 个分区仍有英文`);
	process.exitCode = bad === 0 ? 0 : 2;
} finally {
	if (browser) await browser.close().catch(() => {});
	if (!KEEP) server.child.kill();
}
