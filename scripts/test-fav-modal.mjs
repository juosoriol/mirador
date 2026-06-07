/**
 * Emula resize y verifica overflow del modal "Mis vistas guardadas".
 * node scripts/test-fav-modal.mjs
 */
import puppeteer from 'puppeteer';

const URL = 'http://127.0.0.1:8000/';
const widths = [320, 390, 500, 800, 1200];
const issues = [];

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// Favoritos de prueba en localStorage
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
await page.reload({ waitUntil: 'networkidle2' });
await page.evaluate(() => {
  const favs = Array.from({ length: 10 }, (_, i) => ({
    name: `Vista prueba ${i + 1} con nombre largo`,
    summary: `${i + 2} filtros`,
    date: '06 jun 2026',
    state: { fileName: 'Vacantes Abril 2026.xlsx', colFilters: { Col: ['A'] } }
  }));
  localStorage.setItem('mirador_favorites_v1', JSON.stringify(favs));
});

for (const w of widths) {
  await page.setViewport({ width: w, height: 700 });
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-modal-vp');
    if (typeof _modalVp !== 'undefined') _modalVp = null;
    document.getElementById('fav-overlay')?.classList.remove('open');
  });
  await page.evaluate(() => openViewsPanel());
  await page.waitForSelector('#fav-overlay.open', { timeout: 5000 });

  const result = await page.evaluate((vw) => {
    const overlay = document.getElementById('fav-overlay');
    const modal = document.getElementById('fav-modal');
    const list = document.getElementById('fav-list');
    const saveRow = document.getElementById('fav-save-row');
    const or = overlay.getBoundingClientRect();
    const mr = modal.getBoundingClientRect();
    const lr = list.getBoundingClientRect();
    return {
      vw,
      overlayOverflows: or.bottom > window.innerHeight + 1 || or.right > window.innerWidth + 1 || or.left < -1,
      modalOverflows: mr.bottom > window.innerHeight + 1 || mr.right > window.innerWidth + 1 || mr.left < -1,
      modalW: Math.round(mr.width),
      modalH: Math.round(mr.height),
      listScrollable: list.scrollHeight > list.clientHeight,
      listOverflowsModal: lr.bottom > mr.bottom + 2,
      saveRowOverflow: saveRow.scrollWidth > saveRow.clientWidth + 8,
      saveFlex: getComputedStyle(saveRow).flexDirection,
      vp: document.documentElement.dataset.modalVp || 'none'
    };
  }, w);

  if (result.modalOverflows) issues.push(`${w}px: modal sale del viewport (${result.modalW}x${result.modalH}, vp=${result.vp})`);
  if (result.saveRowOverflow) issues.push(`${w}px: fila "Guardar vista" desborda horizontalmente`);
  if (result.listOverflowsModal) issues.push(`${w}px: lista desborda el modal (scroll interno roto)`);
  console.log(`${w}px OK — modal ${result.modalW}x${result.modalH}, lista scroll=${result.listScrollable}, vp=${result.vp}, saveFlex=${result.saveFlex}`);
}

await browser.close();

if (issues.length) {
  console.error('\nFALLÓ:');
  issues.forEach(i => console.error(' -', i));
  process.exit(1);
}
console.log('\nTodos los anchos pasaron sin desbordes.');
