// 探针：打开设置的某个分区，截图并 dump 全部文本（含 title/aria-label/placeholder 属性）
// 用法: node tools/probe-section.mjs <分区名> <截图路径> [port]
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const APP = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone';
const DATA = 'C:/Users/LENOVO/AppData/Roaming/LearnHarness/data';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SECTION = process.argv[2] || '富文本代码块';
const SHOT = process.argv[3] || 'tools/e2e-out/section.png';
const PORT = Number(process.argv[4] || 39550);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const child = spawn(process.execPath, ['server.js'], {
	cwd: APP,
	env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', LH_DATA_DIR: DATA, NODE_ENV: 'production' },
	stdio: ['ignore', 'pipe', 'pipe'],
});
const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 60; i++) {
	try { if ((await fetch(base + '/')).ok) break; } catch {}
	await sleep(1000);
}

let browser;
try {
	browser = await puppeteer.launch({
		executablePath: CHROME, headless: true,
		args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,1000', '--lang=zh-CN'],
		defaultViewport: { width: 1440, height: 1000 },
	});
	const page = await browser.newPage();
	await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 });
	await sleep(1200);
	await page.evaluate(() => [...document.querySelectorAll('button,a')].find(el => (el.innerText || '').trim() === '设置')?.click());
	await sleep(1000);
	const ok = await page.evaluate(n => {
		const dialog = document.querySelector('[role="dialog"]') || document;
		const el = [...dialog.querySelectorAll('button,a,[role="tab"],[role="button"]')].find(e => (e.innerText || '').trim() === n);
		el?.click();
		return Boolean(el);
	}, SECTION);
	await sleep(1500);
	await page.screenshot({ path: SHOT, fullPage: false });
	const dump = await page.evaluate(() => {
		const dialog = document.querySelector('[role="dialog"]') || document.body;
		const attrs = [];
		for (const el of dialog.querySelectorAll('*')) {
			for (const a of ['title', 'aria-label', 'placeholder', 'alt', 'aria-description']) {
				const v = el.getAttribute(a);
				if (v && /[A-Za-z]{3,}/.test(v)) attrs.push(`[${a}] ${v}`);
			}
		}
		return { text: dialog.innerText, attrs: [...new Set(attrs)], html: dialog.innerHTML.length };
	});
	console.log('section:', SECTION, 'clicked:', ok, 'html', dump.html);
	console.log('--- 文本 ---');
	console.log(dump.text);
	if (dump.attrs.length) {
		console.log('--- 属性 ---');
		console.log(dump.attrs.join('\n'));
	}
	console.log('截图:', SHOT);
} finally {
	if (browser) await browser.close().catch(() => {});
	child.kill();
}
