// Generates SHOS-V2/all-modules-card-comparison.html
// Renders every card design from all 8 module mockups in one file, each module's
// CSS scoped under .mod-<name> (incl. its :root vars) so nothing collides.
const fs = require('fs');
const base = 'C:/Users/kanem/SHOS-V2/';

const MODULES = [
  { file: 'healthcare-sti-test-card.html', name: 'sti', title: 'Healthcare · STI tests', note: 'Reference grammar: dot, byline, summary state line (BOOKED/PENDING/POSITIVE/NEGATIVE/OVERDUE/VOID), ctx-groups with colour bar + tint, ghost chips, btn-sm actions, episode tag.' },
  { file: 'healthcare-testing-card-mockup.html', name: 'testing', title: 'Healthcare · Testing (audit)', note: 'Proposed list card. C&S card carries the advisory pattern (indent + 3px colour bar + tinted background) now standard everywhere.' },
  { file: 'healthcare-testing-render-mockup.html', name: 'testing-render', title: 'Healthcare · Testing (render set)', note: 'Reference grammar render: BOOKED / PENDING / POSITIVE / NEGATIVE / OVERDUE / VOID + fully-populated card covering every form field including treatment-via-clinic-visit. 393dp device, STI grammar, healthcare accent.' },
  { file: 'healthcare-card-mockup.html', name: 'healthcare', title: 'Healthcare · General records', note: 'NEGATIVE / OVERDUE / ACTIVE summary words; advisory + note blocks with the bar+tint treatment.' },
  { file: 'medication-card-mockup.html', name: 'medication', title: 'Medication (audit)', note: 'Shipped reference for byline (quantity + timing) and stock/adherence. Advisory + note use the bar+tint treatment; actions on the 40/32px tiers.' },
  { file: 'healthcare-medication-render-mockup.html', name: 'medication-render', title: 'Healthcare · Medication (render set)', note: 'Full 1:1 form→card render: on-track / refill-due / archived + fully-populated card covering name, units, route, type, category, dose components, schedule, stock/refill, adherence, dose history, notes. 393dp device, STI grammar, meds-blue accent.' },
  { file: 'healthcare-clinicvisit-card-mockup.html', name: 'clinicvisit', title: 'Healthcare · Clinic visits (audit)', note: 'Dot = action state. DUE / BOOKED / COMPLETED summary words.' },
  { file: 'healthcare-clinicvisit-render-mockup.html', name: 'clinicvisit-render', title: 'Healthcare · Clinic visits (render set)', note: 'Full 1:1 form→card render: BOOKED / COMPLETED / DUE / older + fully-populated card covering every capturable form field. 393dp device, STI grammar, clinic accent.' },
  { file: 'healthcare-vaccination-card-mockup.html', name: 'vaccination', title: 'Healthcare · Vaccinations (audit)', note: 'Dose-progress strip is unique to this module. COMPLETE / OVERDUE summary words.' },
  { file: 'healthcare-vaccination-render-mockup.html', name: 'vaccination-render', title: 'Healthcare · Vaccinations (render set)', note: 'Full 1:1 form→card render: COMPLETE / OVERDUE / DUE / older + fully-populated card covering dose series, next-due per dose, provider, injection site, reason, symptom link. 393dp device, STI grammar, clinic accent.' },
  { file: 'healthcare-symptom-card-mockup.html', name: 'symptom', title: 'Healthcare · Symptom log (audit)', note: 'Severity chips mirror the dot colour. ACTIVE / RESOLVED summary words; active entries never fade.' },
  { file: 'healthcare-symptom-render-mockup.html', name: 'symptom-render', title: 'Healthcare · Symptom log (render set)', note: 'Full 1:1 form→card render: ACTIVE / RESOLVED / older + fully-populated card covering multiple symptoms, severity, start/resolved dates, linked encounter & test, notes. 393dp device, STI grammar, clinic accent.' },
  { file: 'encounters-card-mockup.html', name: 'encounters', title: 'Encounters (audit)', note: 'Record list, not a state screen: metadata summary (rating · date · relative · climax), module-accent chips, notes in the bar+tint pattern. Light-mode variant included.' },
  { file: 'healthcare-encounters-render-mockup.html', name: 'encounters-render', title: 'Healthcare · Encounters (render set)', note: 'Full 1:1 form→card render: metadata summary (rating · date · relative · climax), attendees, position, activities, protection, cum/loads, notes, linked test/encounter/symptoms. 393dp device, STI grammar, teal accent.' },
  { file: 'contacts-card-mockup.html', name: 'contacts', title: 'Contacts', note: 'Detail screen — deliberately outside the list-card grammar (no summary/byline). Availability line + schedule concept below.' },
  { file: 'healthcare-contacts-render-mockup.html', name: 'contacts-render', title: 'Healthcare · Contacts (render set)', note: 'Full 1:1 form→card render: name, pronouns, gender, age, HIV status + date informed, contact methods, availability, location, kinks/limits/chems, relationship type, notes. 393dp device, contacts accent, no state vocab (detail screen).' },
  { file: 'healthcare-vaginal-health-render-mockup.html', name: 'vaginal-health-render', title: 'Healthcare - Vaginal health (render set)', note: 'Full 1:1 form-card render.' }
];

const SKIP = /^(body|html|main|h1|h2|p|table|th|td|:root|@media|@keyframes|\*)/.test.bind(/^$/) || null;
const skipSel = s => {
  const t = s.trim();
  if (!t) return true;
  if (/^(body|html|main|h1|h2|h3|p|table|th|td|:root|\*)/.test(t)) return true;
  if (/^(\.lead|\.caption|\.page|\.group-label|\.module-title|\.ok|\.miss|\.part|\.now|\.annotation)\b/.test(t)) return true;
  return false;
};

function extractVars(css) {
  const m = css.match(/:root\s*\{([^{}]*)\}/);
  return m ? m[1] : '';
}

function scopeFlatRules(css, mod) {
  let out = '';
  // pull out @media blocks first, scope their inner rules, keep wrapper
  const mediaRe = /@media[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g;
  let mediaOut = [];
  css = css.replace(mediaRe, block => { mediaOut.push(block); return ''; });
  for (const block of mediaOut) {
    const head = block.match(/^@media[^{]+/)[0];
    const inner = block.slice(head.length).replace(/^\{/, '').replace(/\}$/, '');
    const scopedInner = scopeFlatRules(inner, mod);
    if (scopedInner.trim()) out += head + '{' + scopedInner + '}\n';
  }
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css)) !== null) {
    const sels = m[1].split(',').map(s => s.trim()).filter(s => !skipSel(s));
    if (!sels.length) continue;
    out += sels.map(s => `.mod-${mod} ` + s).join(', ') + ' {' + m[2] + '}\n';
  }
  return out;
}

function extractCards(html) {
  return [...html.matchAll(/<article class="card[\s\S]*?<\/article>/g)].map(x => x[0]);
}

let cssOut = `
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 24px 14px 48px; background: #121214; color: #F2F2F4; font-family: Inter, Roboto, "Segoe UI", sans-serif; }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 6px; }
    p { margin: 0; }
    .lead { color: #B8B8BE; font-size: 12px; line-height: 1.5; margin-bottom: 4px; max-width: 980px; }
    .mods { display: flex; flex-wrap: wrap; gap: 26px; align-items: flex-start; margin-top: 20px; }
    .mod { flex: 1 1 420px; max-width: 600px; min-width: 0; width: min(100%, 600px); }
    .mod-title { font-size: 14px; font-weight: 700; margin: 0 0 2px; }
    .mod-meta { font-size: 11px; color: #89898C; margin: 0 0 10px; line-height: 1.5; }
    .mod-meta b { color: #B8B8BE; font-weight: 600; }
    .mod .device { width: 100%; max-width: 393px; margin: 0 auto; }
    @media (max-width: 430px) { .mod { min-width: 0; flex-basis: 100%; } .mod .device { max-width: 100%; } }
`;

let bodyOut = [];
bodyOut.push(`  <h1>SHOS-V2 — all-module card design comparison</h1>
  <p class="lead">Every card design from the eight module mockups, rendered with each module's own scoped CSS. Shared standards as of 11 Nov 2026: dark neutral ladder · 393dp device · day-first unpadded dates (weekday prefix on planned) · lead-word summary line coloured by state · .btn 40px base / .btn-sm 32px actions · :focus-visible rings · in-card notes and advisories use the indent + 3px colour bar + tinted background pattern.</p>`);

for (const mod of MODULES) {
  const html = fs.readFileSync(base + mod.file, 'utf8');
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  const css = styleMatch ? styleMatch[1] : '';
  const vars = extractVars(css);
  const scoped = scopeFlatRules(css.replace(/:root\s*\{[^{}]*\}/, ''), mod.name);
  cssOut += `\n    /* ── ${mod.title} (${mod.file}) ── */\n    .mod-${mod.name} {${vars}}\n` + scoped;
  const cards = extractCards(html);
  bodyOut.push(`  <section class="mod mod-${mod.name}">
    <h2 class="mod-title">${mod.title}</h2>
    <p class="mod-meta"><b>${mod.file}</b> · ${cards.length} card${cards.length === 1 ? '' : 's'} — ${mod.note}</p>
    <div class="device">
${cards.join('\n')}
    </div>
  </section>`);
}

const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SHOS-V2 — all-module card design comparison</title>
<style>${cssOut}</style>
</head>
<body>
<main>
${bodyOut.join('\n\n')}
</main>
</body>
</html>
`;

fs.writeFileSync(base + 'all-modules-card-comparison.html', doc);
console.log('written all-modules-card-comparison.html,', Math.round(doc.length / 1024) + 'KB');
MODULES.forEach(m => console.log(m.name + ': ' + extractCards(fs.readFileSync(base + m.file, 'utf8')).length + ' cards'));
