// QA AC6 尾项：390 档首页真浏览器探针（#root 非空 / 零 pageerror / 首卡标题可上屏）
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json');
const { chromium } = require('playwright');

const URL = process.env.SF_FE || 'http://localhost:5787/';
const stub = await (await fetch('http://localhost:5788/api/home')).json();
const apiFirst = stub.data.prizes[0];

const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e && e.message ? e.message : e)));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });

const resp = await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('[data-sf-m="reward-card"]', { timeout: 20000 });
await page.waitForTimeout(1200); // 入场动画（reducedMotion 已压制）+ 数据落定

const read = await page.evaluate((apiTitle) => {
  const root = document.querySelector('#root');
  const cards = [...document.querySelectorAll('[data-sf-m="reward-card"]')];
  const first = cards[0];
  const titleEl = first ? first.querySelector('h1,h2,h3,h4,.text-lg,.text-base') : null;
  return {
    rootInnerHtmlLen: root ? root.innerHTML.length : 0,
    rootTextLen: root ? (root.innerText || '').length : 0,
    cardCount: cards.length,
    firstCardHref: first ? first.getAttribute('href') : null,
    firstCardTitleText: titleEl ? titleEl.innerText.trim() : null,
    firstCardFullText: first ? first.innerText.trim().slice(0, 200) : null,
    cardTitles: cards.map((c) => {
      const t = c.querySelector('h1,h2,h3,h4,.text-lg,.text-base');
      return t ? t.innerText.trim() : null;
    }),
    bodyIncludesApiTitle: document.body.innerText.includes(apiTitle),
    docScrollWidthDelta: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
}, apiFirst.name);

const shotsDir = 'ops/feed-ranking/qa/shots';
fs.mkdirSync(shotsDir, { recursive: true });
await page.screenshot({ path: `${shotsDir}/${process.env.SF_SHOT || 'home-390.png'}`, fullPage: false });

const checks = {
  http_200: resp ? resp.status() === 200 : false,
  root_not_empty: read.rootInnerHtmlLen > 0,
  cards_present: read.cardCount >= 1,
  first_card_is_api_first_listing: (read.firstCardTitleText || '').includes(apiFirst.name) || (read.firstCardFullText || '').includes(apiFirst.name),
  api_first_title_found_on_page: read.bodyIncludesApiTitle,
  first_card_href_points_to_item_detail: /\/(item)\/\d+/.test(read.firstCardHref || ''),
  zero_pageerror: pageErrors.length === 0,
};

const out = {
  taken_at: new Date().toISOString(),
  url: URL,
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true },
  api_first: { bID: Number(apiFirst.bID), name: apiFirst.name },
  observed: read,
  page_errors: pageErrors,
  console_errors: consoleErrors,
  checks,
};
out.verdict = Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL';
fs.writeFileSync(process.env.SF_OUT || 'ops/feed-ranking/qa/readings/ui-390-home.json', JSON.stringify(out, null, 2));
console.log('verdict', out.verdict);
console.log(JSON.stringify({ observed: read, pageErrors, consoleErrors: consoleErrors.slice(0, 5) }, null, 1));
await browser.close();
