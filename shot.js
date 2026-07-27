// Script temporal de auditoria responsive -- toma capturas legibles (viewport real, no
// fullPage escalado) recorriendo el scroll de la pagina. Uso: node shot.js <nombre> <path> [storageStateJsonPath]
const { chromium } = require('playwright');

const BASE = 'https://lokomproaqui.com';
const OUT = 'C:/Users/MOINS/AppData/Local/Temp/claude/C--Users-MOINS/8b35cf51-5676-4995-9922-bda5c59f9e5d/scratchpad/screenshots';

async function captureScrolled(page, nombre, suffix, viewportHeight, maxParts) {
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  let y = 0;
  let i = 0;
  while (y < totalHeight && i < maxParts) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${nombre}-${suffix}-p${i}.png` });
    y += viewportHeight;
    i++;
  }
  return { totalHeight, overflowX, parts: i };
}

async function shoot(browser, contextOpts, nombre, suffix, viewportHeight, maxParts) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[pageerror:${suffix}]`, e.message));
  const resp = await page.goto(BASE + process.argv[3], { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => { console.log('[goto error]', e.message); return null; });
  await page.waitForTimeout(10000);
  const info = await captureScrolled(page, nombre, suffix, viewportHeight, maxParts);
  console.log(`[${suffix}] status=${resp ? resp.status() : 'no-response'} totalHeight=${info.totalHeight} overflowX=${info.overflowX} parts=${info.parts}`);
  await ctx.close();
}

async function main() {
  const [, , nombre, , storageStateArg] = process.argv;
  const browser = await chromium.launch();
  const base = storageStateArg ? { storageState: storageStateArg } : {};

  await shoot(browser, { ...base, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }, nombre, 'mobile', 844, 8);
  await shoot(browser, { ...base, viewport: { width: 1440, height: 900 } }, nombre, 'desktop', 900, 6);

  await browser.close();
  console.log('OK', nombre);
}

main().catch((e) => { console.error(e); process.exit(1); });
