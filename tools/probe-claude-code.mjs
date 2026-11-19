// 探针：看「服务商」页里 Claude Code 那一行的开关能不能点，点了之后状态是什么
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const APP = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone';
const DATA = 'C:/Users/LENOVO/AppData/Roaming/LearnHarness/data';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.argv[2] || 39540);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const child = spawn(process.execPath, ['server.js'], {
	cwd: APP,
	env: { ...process.env, PORT: String(PORT), HOSTNAME: '127.0.0.1', LH_DATA_DIR: DATA, NODE_ENV: 'production' },
	stdio: ['ignore', 'pipe', 'pipe'],
});
const log = [];
child.stdout.on('data', d => log.push(String(d)));
child.stderr.on('data', d => log.push(String(d)));

const base = `http://127.0.0.1:${PORT}`;
for (let i = 0; i < 60; i++) {
	try { if ((await fetch(base + '/')).ok) break; } catch {}
	await sleep(1000);
}

let browser;
try {
	browser = await puppeteer.launch({
		executablePath: CHROME, headless: true,
		args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900', '--lang=zh-CN'],
		defaultViewport: { width: 1440, height: 900 },
	});
	const page = await browser.newPage();
	const netlog = [];
	page.on('response', async r => {
		if (r.url().includes('/api/')) netlog.push(`${r.status()} ${r.request().method()} ${r.url().replace(base, '')}`);
	});
	await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 });
	await sleep(1200);
	await page.evaluate(() => {
		const btn = [...document.querySelectorAll('button,a')].find(el => (el.innerText || '').trim() === '设置');
		btn?.click();
	});
	await sleep(1000);
	await page.evaluate(() => {
		const el = [...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].find(e => (e.innerText || '').trim() === '服务商');
		el?.click();
	});
	await sleep(1200);

	const before = await page.evaluate(() => {
		const row = document.querySelector('[data-testid="claude-code-installation"]');
		if (!row) return { found: false };
		const toggle = row.querySelector('button[role="switch"], button[aria-checked], input[type="checkbox"], button');
		return {
			found: true,
			text: row.innerText,
			toggleTag: toggle?.tagName,
			toggleRole: toggle?.getAttribute('role'),
			checked: toggle?.getAttribute('aria-checked') ?? toggle?.checked ?? null,
			disabled: toggle?.disabled ?? toggle?.getAttribute('aria-disabled') ?? null,
			html: row.innerHTML.slice(0, 700),
		};
	});
	console.log('== 开启前 ==');
	console.log(JSON.stringify(before, null, 2).slice(0, 2000));

	await page.evaluate(() => {
		const row = document.querySelector('[data-testid="claude-code-installation"]');
		const toggle = row?.querySelector('button[role="switch"], button[aria-checked], button');
		toggle?.click();
	});
	await sleep(2500);

	const after = await page.evaluate(() => {
		const row = document.querySelector('[data-testid="claude-code-installation"]');
		return { text: row?.innerText ?? '(未找到)' };
	});
	console.log('== 点击后 ==');
	console.log(after.text);
	console.log('== /api 请求 ==');
	console.log(netlog.join('\n'));
} finally {
	if (browser) await browser.close().catch(() => {});
	child.kill();
}
