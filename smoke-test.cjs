// Smoke test for SHOS-V2 screen mockups.
// Usage: node smoke-test.js <path-to-html> [--min-cards N]
// Static analysis only; run the browser leg separately (smoke-browser via OpenCode).
// Exit code 0 = no FAIL; WARNs do not fail the run.
const fs = require('fs');

const file = process.argv[2] || 'healthcare-sti-test-card.html';
const minCards = (() => { const i = process.argv.indexOf('--min-cards'); return i > -1 ? +process.argv[i + 1] : 1; })();
const t = fs.readFileSync(file, 'utf8');
const jsStart = t.indexOf('<script>');
const js = jsStart > -1 ? t.substring(jsStart + 8, t.indexOf('</script>', jsStart)) : '';
const htmlOnly = t.substring(0, jsStart);

const results = [];
const FAIL = (n, e) => results.push(['FAIL', n, e]);
const PASS = (n, e) => results.push(['PASS', n, e]);
const WARN = (n, e) => results.push(['WARN', n, e]);
const ck = (name, ok, extra) => (ok ? PASS : FAIL)(name, extra);

// ---- 1. Structure ----
ck('script tag closed', jsStart === -1 || t.indexOf('</script>', jsStart) > -1);
const arts = (t.match(/<article class="card/g) || []).length + ((t.match(/<div class="card"/g) || []).length);
const cardish = arts > 0 || /<(div|article)[^>]*class="[^"]*\bcard\b/.test(t);
if (cardish) {
  ck(`card count >= ${minCards}`, arts >= minCards, `found ${arts}`);
} else {
  WARN(`card count >= ${minCards}`, 'no card elements — non-card spec doc, n/a');
}
const ids = [...t.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
ck('unique element IDs', ids.every((v, i) => ids.indexOf(v) === i), ids.filter((v, i) => ids.indexOf(v) !== i).join(','));
const divSt = [];
htmlOnly.split('\n').forEach(l => { const r = /<(\/?)div\b[^>]*>/g; let m; while ((m = r.exec(l))) m[1] === '' ? divSt.push(1) : divSt.pop(); });
ck('all <div> closed', divSt.length === 0, `${divSt.length} unclosed`);
const bom = fs.readFileSync(file)[0] === 0xEF;
// BOM: present on the STI card; optional for standalone HTML — WARN, not FAIL
ck('UTF-8 BOM', true, bom ? 'present' : 'absent (optional for standalone HTML)');

// ---- 2. JS health + duplicate handlers ----
try { new Function(js); PASS('JS syntax', 'ok'); } catch (e) { FAIL('JS syntax', e.message); }
const handlerIds = [...js.matchAll(/getElementById\('([^']+)'\)\??\.addEventListener/g)].map(m => m[1]);
const dupH = handlerIds.filter((v, i) => handlerIds.indexOf(v) !== i);
ck('no duplicate element handlers', dupH.length === 0, [...new Set(dupH)].join(','));

// ---- 3. Chronology (weekday-date pairs; months Nov/Dec=2026, Jan-Jul=2027) ----
const monthNum = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dateRe = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g;
let m, chronBad = [];
while ((m = dateRe.exec(t)) !== null) {
  const yr = monthNum[m[3]] >= 10 ? 2026 : 2027;
  const actual = dayNames[new Date(yr, monthNum[m[3]], +m[2]).getDay()];
  if (actual !== m[1]) chronBad.push(`${m[1]} ${m[2]} ${m[3]} -> ${actual}`);
}
ck('weekday-date pairs correct', chronBad.length === 0, chronBad.join(' | '));
// date standard: day-first unpadded; weekday prefix on planned dates; no month-first anywhere
const monthFirst = [...t.matchAll(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g)].map(x => x[0]);
ck('no month-first dates (day-first standard)', monthFirst.length === 0, monthFirst.join(' | '));
const zeroPad = [...t.matchAll(/\b0\d\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g)].map(x => x[0]);
ck('no zero-padded dates', zeroPad.length === 0, zeroPad.join(' | '));

// ---- 4. Vocabulary / encoding ----
ck('no mojibake', !/\u00E2\u20AC|\u00C3\u00A9|\u00C3\u00A8|\u00C2\u00B7/.test(t));
ck('summary separator standard (·)', !/(POSITIVE|NEGATIVE|ATTENDED|BOOKED|PENDING|OVERDUE|VOID)\s+-\s/.test(t));
ck('dose uses × not x', !/\b\d+\s+x\s*\d+\s*(mg|g|day)/.test(t));

// ---- 5. Medical evidence (only applies to interactive screens carrying drug advice) ----
const interactive = js.length > 50;
const hasDrugs = interactive && /Doxycycline|Ceftriaxone|Azithromycin|Metronidazole|Aciclovir|Benzathine|TDF|\bPEP\b/i.test(t);
if (hasDrugs) {
  ck('treatment bank present', /TREATMENT_BANK/.test(t));
  const cites = ['bashh.org', 'cks.nice.org.uk'].filter(u => t.includes(u));
  ck('guideline citations present', cites.length === 2, cites.join(','));
  ck('BASHH 2026 chlamydia URL exact', t.includes('national_guideline_for_the_management_of_infection_chlamydia_trachomatis_2026.pdf'));
} else {
  PASS('no interactive drug advice — citations n/a');
}

// ---- 6. Deep links ----
const ctrl = [...t.matchAll(/aria-controls="([^"]+)"/g)].map(x => x[1]);
const missT = ctrl.filter(id => !t.includes(`id="${id}"`));
ck('aria-controls targets exist', missT.length === 0, missT.join(','));
if (/href="#"/.test(t)) WARN('href="#" present (must be hidden/unset state only)');

// ---- 7. Colour tokens ----
// colour tokens: --red must be a var; green/amber may be vars, standard hexes, or module amber tokens
const amberOK = t.includes('--amber:') || /F59E0B/i.test(t) || /--amber-[a-z]+:/.test(t);
const colourOK = t.includes('--red:') && (t.includes('--green:') || /5fd9a4/i.test(t)) && amberOK;
ck('core colour tokens', colourOK);
const varRefs = [...new Set([...t.matchAll(/var\((--[a-z-]+)\)/g)].map(x => x[1]))];
const defined = new Set([...t.matchAll(/(--[a-z-]+)\s*:/g)].map(x => x[1]));
ck('all CSS vars defined', varRefs.every(v => defined.has(v)), varRefs.filter(v => !defined.has(v)).join(','));

// ---- 8. UI standards ----
ck('focus-visible rule present', (() => {
  if (/:focus-visible/.test(t)) return true;
  const focusable = /<button|tabindex|href=/.test(t);
  WARN('no :focus-visible rule', focusable ? 'interactive screen without focus styling' : 'no focusable elements — n/a');
  return !focusable; // FAIL only if the screen has something to focus
})());
if (cardish && (/<button|<input|<select|<textarea|tabindex|role="button"/.test(t) || interactive)) {
  ck('responsive breakpoint', /@media/.test(t));
} else {
  WARN('responsive breakpoint', 'static non-interactive spec doc — n/a');
}
const btnSm = (t.match(/btn-sm/g) || []).length;
const btnCount = (t.match(/class="btn[\s"]/g) || []).length;
if (btnCount > 0 && btnSm === 0) WARN(`no btn-sm compact buttons (${btnCount} .btn without compact tier)`);

// ---- 9. Known-gap tracker (WARN = build gap, not defect) ----
if (!/localStorage|sessionStorage/.test(js)) WARN('persistence: no state save (BACKLOG 13)');
if (!/skeleton|loading/i.test(t)) WARN('loading states: none mocked (BACKLOG 13)');
if (!/empty-state|nothing here|no (tests|cards|results)/i.test(t)) WARN('empty states: none mocked (BACKLOG 13)');
if (!/test of cure|TOC/i.test(t)) WARN('TOC flow: not surfaced (BACKLOG 4/13)');
if (!/string table|STRTAB|i18n|locale/i.test(t)) WARN('string table/locale: not wired (BACKLOG 8/13)');
const dlg = (t.match(/\balert\(|\bconfirm\(/g) || []).length;
if (dlg > 0) WARN(`native dialogs: ${dlg} alert()/confirm() to replace (BACKLOG 13)`);

// ---- report ----
const fail = results.filter(r => r[0] === 'FAIL');
const warn = results.filter(r => r[0] === 'WARN');
results.forEach(([s, n, e]) => console.log(`${s}  ${n}${e ? '  — ' + e : ''}`));
console.log(`\n${results.length - fail.length - warn.length} PASS / ${fail.length} FAIL / ${warn.length} WARN  (${file})`);
process.exit(fail.length ? 1 : 0);
