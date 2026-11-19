// 探针：dump 设置页某分区里每条「标签行」的 DOM 结构，用于决定怎么插入中文注释
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';

const APP = 'C:/Users/LENOVO/AppData/Local/Programs/learnharness/resources/server/standalone';
const DATA = 'C:/Users/LENOVO/AppData/Roaming/LearnHarness/data';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SECTION = process.argv[2] || '富文本代码块';
const PORT = Number(process.argv[3] || 39580);
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
	browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--lang=zh-CN'], defaultViewport: { width: 1440, height: 1000 } });
	const page = await browser.newPage();
	await page.goto(base + '/', { waitUntil: 'networkidle2', timeout: 60000 });
	await sleep(1200);
	await page.evaluate(() => [...document.querySelectorAll('button,a')].find(el => (el.innerText || '').trim() === '设置')?.click());
	await sleep(1000);
	await page.evaluate(n => [...document.querySelectorAll('button,a,[role="tab"],[role="button"]')].find(e => (e.innerText || '').trim() === n)?.click(), SECTION);
	await sleep(1500);
	const rows = await page.evaluate(() => {
		const dialog = document.querySelector('[role="dialog"]') || document.body;
		const toggles = [...dialog.querySelectorAll('button[role="switch"]')];
		return toggles.map(t => {
			// 向上走到一个「包含标签文本」的行容器
			let row = t.parentElement;
			for (let i = 0; i < 4 && row?.parentElement; i++) {
				if ((row.innerText || '').split('\n').filter(Boolean).length > 1) break;
				row = row.parentElement;
			}
			return { label: row?.innerText, html: row?.outerHTML.slice(0, 800) };
		});
	});
	console.log(JSON.stringify(rows, null, 2));
} finally {
	if (browser) await browser.close().catch(() => {});
	child.kill();
}
