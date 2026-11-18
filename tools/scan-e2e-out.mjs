// 从 e2e 抓下来的分区文本里挑出「还没中文的行」，用来补词表
import fs from 'node:fs';
import path from 'node:path';

const dict = JSON.parse(fs.readFileSync('dict.source.json', 'utf8'));
const DIR = 'tools/e2e-out';
const ALLOW = [
	'Learning Harness', 'ChatGPT', 'GitHub Copilot', 'Grok', 'Claude Code', 'Deepgram', 'Tavily',
	'Brave', 'Exa', 'Firecrawl', 'Ollama', 'API', 'JSON', 'Markdown', 'token', 'FSRS', 'SMILES',
	'ABC', 'TikZ', 'Anki', 'Source Sans', 'Catppuccin', 'Gruvbox', 'NvChad', 'Ivory', 'Pastel',
	'Pine', 'Ros', 'Rose', 'Latte', 'Frapp', 'Macchiato', 'Mocha', 'Onedark', 'Dawn',
];
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.txt')) : [];
for (const f of files) {
	const lines = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n');
	const out = [];
	for (const line of lines) {
		const t = line.trim();
		if (!t || !/[A-Za-z]{3,}/.test(t)) continue;
		if (dict[t.trim()]) continue;
		if (ALLOW.some(a => t.includes(a))) continue;
		if (/^[\d\s.,:%#()×+-]+$/.test(t)) continue;
		if (/^[a-z0-9]+\/[a-z0-9]+$/.test(t)) continue;
		out.push(t);
	}
	if (out.length) {
		console.log('=== ' + f.replace('.txt', ''));
		for (const t of [...new Set(out)]) console.log('  ' + JSON.stringify(t));
	}
}
