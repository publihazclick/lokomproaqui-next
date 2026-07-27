// Barrido automatizado: para cada ruta, en mobile (390) y desktop (1440), detecta overflow
// horizontal real (el bug mas comun de responsive) y errores de consola/pagina.
// Uso: node sweep.js <storageStateFile-o-guion> <ruta1> <ruta2> ...
const { chromium } = require('playwright');

const BASE = 'https://lokomproaqui.com';

async function checkOverflow(page) {
  return page.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const scrollW = document.documentElement.scrollWidth;
    if (scrollW <= docW + 2) return { overflow: false };
    const culpables = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > docW + 2 && r.width > 20) {
        culpables.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), right: Math.round(r.right), width: Math.round(r.width) });
      }
    });
    return { overflow: true, scrollW, docW, culpables: culpables.slice(0, 5) };
  });
}

async function checkRuta(browser, storageState, ruta) {
  const resultados = {};
  for (const [suffix, vp] of [['mobile', { width: 390, height: 844, isMobile: true }], ['desktop', { width: 1440, height: 900 }]]) {
    const ctxOpts = { viewport: vp, isMobile: vp.isMobile, hasTouch: !!vp.isMobile };
    if (storageState) ctxOpts.storageState = storageState;
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    let status = null;
    try {
      const resp = await page.goto(BASE + ruta, { waitUntil: 'domcontentloaded', timeout: 20000 });
      status = resp ? resp.status() : null;
      await page.waitForTimeout(5000);
      const overflow = await checkOverflow(page);
      const urlFinal = page.url();
      resultados[suffix] = { status, urlFinal, overflow, errores };
    } catch (e) {
      resultados[suffix] = { status, error: e.message, errores };
    }
    await ctx.close();
  }
  return resultados;
}

async function main() {
  const [, , storageStateArg, ...rutas] = process.argv;
  const storageState = storageStateArg && storageStateArg !== '-' ? storageStateArg : null;
  const browser = await chromium.launch();
  for (const ruta of rutas) {
    const r = await checkRuta(browser, storageState, ruta);
    console.log('\n=== ' + ruta + ' ===');
    console.log(JSON.stringify(r, null, 1));
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
