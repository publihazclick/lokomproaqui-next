const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: 'qa-storage-state.json', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on('request', (r) => {
    if (r.url().includes('supabase.co')) console.log(`[req +${Date.now() - t0}ms]`, r.method(), r.url().replace(/https:\/\/[^/]+/, ''));
  });
  page.on('response', (r) => {
    if (r.url().includes('supabase.co')) console.log(`[res +${Date.now() - t0}ms]`, r.status(), r.url().replace(/https:\/\/[^/]+/, ''));
  });
  await page.goto('https://lokomproaqui.com/pedidos', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log(`[domcontentloaded +${Date.now() - t0}ms]`);
  await page.waitForTimeout(20000);
  await browser.close();
}
main();
