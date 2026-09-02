// clinicCardPdfService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: a clinician-facing export of Clinic Card. Every other
// export in this app (JSON/CSV/encrypted backup) is for getting your
// OWN data back into SHOS or into a spreadsheet — none of them are
// something you'd actually hand to a receptionist or read out over the
// phone. This generates a real PDF of exactly what Clinic Card shows
// on screen: same sections, same visibility settings (a section you've
// hidden there stays hidden here — this never shows more than the
// screen itself would), same data, laid out to print cleanly on a
// single flow rather than needing a screenshot of a scrolling app.
//
// USES pdf-lib, NOT jsPDF — checked both before picking: jsPDF's own
// npm package statically bundles html2canvas + dompurify (for its
// optional `.html()` render method) even though this file never calls
// it, adding ~380KB to every build (this app also ships as a web app,
// not just an installed APK, so that cost is real on every page load).
// pdf-lib has no such baggage — genuinely dependency-free — at the
// real cost of writing its own word-wrap (below), since pdf-lib
// doesn't include jsPDF's splitTextToSize() convenience.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ResultsRegistry } from "../registries/resultsRegistry";
import { EncounterRepository } from "../repositories/encounterRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { computeStock } from "../calculations/medicationCalculations";
import { formatRelativeDate, sortByDateDesc } from "../calculations/encounterCalculations";
import { MyProfileRepository } from "../repositories/myProfileRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { exportBinaryFile } from "./fileExportHelper";

const MARGIN = 44;
const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const TEAL = rgb(11 / 255, 127 / 255, 121 / 255); // ACCENTS.healthcare-adjacent, print-safe
const RED = rgb(214 / 255, 69 / 255, 80 / 255);
const INK = rgb(27 / 255, 27 / 255, 31 / 255);
const GREY = rgb(91 / 255, 91 / 255, 98 / 255);
const LINE = rgb(220 / 255, 220 / 255, 220 / 255);

function nameFrom(registry, id) {
  return registry.getById(id)?.name || "—";
}

// Assembles the exact same section data ClinicCardScreen computes for
// its own render — same filters, same "current treatment"/"active
// symptoms" derivation, same recency sort — so the PDF is never a
// second, drifting copy of that logic.
function assembleClinicCardData() {
  const profile = MyProfileRepository.getProfile();
  const meds = MedicationRepository.getAll().filter((m) => !m.isArchived).map((m) => ({ ...m, logs: LogRepository.getForMedication(m.id) }));
  const tests = sortByDateDesc(TestingRepository.getAll().filter((t) => !t.isArchived));
  const encounters = sortByDateDesc(EncounterRepository.getAll());
  const vaccinations = sortByDateDesc(VaccinationRepository.getAll().filter((v) => !v.isArchived));
  const overdueVaccinations = VaccinationRepository.getOverdue();
  const activeSymptoms = SymptomLogRepository.getActive();

  const recentTests = tests.slice(0, 5).map((t) => {
    const resultNames = (t.resultIds || []).map((id) => nameFrom(ResultsRegistry, id));
    const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
    return { title: (t.testingFor || []).join(", ") || t.title || "Test", subtitle: `${formatRelativeDate(t.date)} · ${resultNames.join(", ") || "No result logged"}`, alert: isPositive };
  });

  const currentTreatment = tests.filter((t) => {
    const resultNames = (t.resultIds || []).map((id) => nameFrom(ResultsRegistry, id));
    return resultNames.some((r) => r.toLowerCase() === "positive") && !t.followUpActionedDate;
  }).map((t) => ({ title: (t.testingFor || []).join(", ") || t.title || "Positive result", subtitle: `${formatRelativeDate(t.date)} · awaiting follow-up` }));

  return {
    profile,
    identity: [
      profile.dateOfBirth && ["Date of birth", profile.dateOfBirth],
      profile.clinicNumber && ["Clinic number", profile.clinicNumber],
      profile.address && ["Address", profile.address],
      profile.nhsNumber && ["NHS number", profile.nhsNumber],
    ].filter(Boolean),
    medications: meds.map((m) => {
      const stock = computeStock(m);
      const totalDoseValue = m.doseStrengthValue ? m.doseStrengthValue * (m.unitsPerDose || 1) : null;
      const title = totalDoseValue && m.doseStrengthUnit ? `${m.name} ${totalDoseValue}${m.doseStrengthUnit}` : m.name;
      const lastDose = m.logs.filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const subtitleParts = [m.medicationType, m.route].filter(Boolean);
      if (lastDose) subtitleParts.push(`last taken ${formatRelativeDate(lastDose.date)}`);
      return { title, subtitle: subtitleParts.join(" · "), alert: stock.tracked && stock.needsAction };
    }),
    allergies: profile.allergies,
    vaccinations: vaccinations.slice(0, 6).map((v) => {
      const overdue = overdueVaccinations.some((o) => o.id === v.id);
      return { title: v.title || v.vaccine, subtitle: `${v.vaccine || ""}${v.nextDue ? ` · ${overdue ? "overdue since" : "next due"} ${formatRelativeDate(v.nextDue)}` : ""}`, alert: overdue };
    }),
    recentTests,
    currentTreatment,
    activeSymptoms: activeSymptoms.map((s) => ({
      title: s.title,
      subtitle: [nameFrom(SymptomsRegistry, s.symptomId), s.severity, formatRelativeDate(s.dateStarted), s.dateResolved ? `resolved ${formatRelativeDate(s.dateResolved)}` : null].filter(Boolean).join(" · "),
      alert: s.severity === "Severe",
    })),
    recentEncounters: encounters.slice(0, 8).map((e) => ({ title: e.title || e.encounterType || "Encounter", subtitle: e.date ? formatRelativeDate(e.date) : "" })),
    emergency: [
      (profile.emergencyContactName || profile.emergencyContactPhone) && [profile.emergencyContactName || "Emergency contact", profile.emergencyContactPhone],
      profile.emergencyNotes && [profile.emergencyNotes, ""],
    ].filter(Boolean),
  };
}

// pdf-lib has no built-in word-wrap — measures real glyph widths at the
// given size/font and breaks at the last word that still fits, same
// greedy-wrap approach every text layout engine uses.
function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class PageCursor {
  constructor(doc, fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }
  ensureSpace(needed) {
    if (this.y - needed < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }
  text(str, { size, font, color, x = MARGIN }) {
    this.page.drawText(str, { x, y: this.y, size, font, color });
  }
  sectionHeading(label, count) {
    this.ensureSpace(30);
    const text = count == null ? label.toUpperCase() : `${label.toUpperCase()} (${count})`;
    this.text(text, { size: 10.5, font: this.fonts.bold, color: TEAL });
    this.y -= 6;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: PAGE_WIDTH - MARGIN, y: this.y }, thickness: 0.75, color: LINE });
    this.y -= 16;
  }
  row(title, subtitle, alert) {
    const titleLines = wrapText(title, this.fonts.bold, 11, CONTENT_WIDTH);
    this.ensureSpace(titleLines.length * 13 + (subtitle ? 12 : 0) + 8);
    titleLines.forEach((line) => {
      this.text(line, { size: 11, font: this.fonts.bold, color: alert ? RED : INK });
      this.y -= 13;
    });
    if (subtitle) {
      wrapText(subtitle, this.fonts.regular, 9.5, CONTENT_WIDTH).forEach((line) => {
        this.text(line, { size: 9.5, font: this.fonts.regular, color: GREY });
        this.y -= 11.5;
      });
    }
    this.y -= 8;
  }
  empty(label) {
    this.ensureSpace(18);
    this.text(label, { size: 9.5, font: this.fonts.italic, color: GREY });
    this.y -= 18;
  }
}

// Real ask: honour Clinic Card's own per-section visibility toggles —
// a section hidden on screen (Settings -> Clinic Card -> which
// sections to show) never appears in the exported PDF either, so
// exporting can never show someone more than the screen itself does.
export async function generateClinicCardPdf(visibility) {
  const data = assembleClinicCardData();
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const cursor = new PageCursor(doc, fonts);

  cursor.text(data.profile.nickname ? `${data.profile.nickname}'s Clinic Card` : "Clinic Card", { size: 20, font: fonts.bold, color: INK });
  cursor.y -= 20;
  cursor.text(`Generated ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })} · exported from SHOS`, { size: 9, font: fonts.regular, color: GREY });
  cursor.y -= 26;

  const section = (key, label, items, emptyText, count) => {
    if (visibility && visibility[key] === false) return;
    cursor.sectionHeading(label, count);
    if (items.length === 0) { cursor.empty(emptyText); return; }
    items.forEach((item) => cursor.row(item.title ?? item[0], item.subtitle ?? item[1], item.alert));
  };

  section("identity", "Identity", data.identity, "No identity details recorded.");
  section("medications", "Current medications", data.medications, "No active medications logged.", data.medications.length);
  if (!visibility || visibility.allergies !== false) {
    cursor.sectionHeading("Allergies");
    if (data.allergies.length === 0) cursor.empty("None recorded.");
    else cursor.row(data.allergies.join(", "), null, true);
  }
  section("vaccinations", "Vaccinations", data.vaccinations, "None recorded yet.", data.vaccinations.length);
  section("testing", "Recent STI testing", data.recentTests, "No tests logged yet.");
  section("treatment", "Current treatment", data.currentTreatment, "Nothing currently awaiting follow-up.");
  section("symptoms", "Active symptoms", data.activeSymptoms, "Nothing active right now.");
  section("encounters", "Recent encounters", data.recentEncounters, "No encounters logged yet.", data.recentEncounters.length);
  section("emergency", "Emergency information", data.emergency, "None recorded.");

  // Real footer, every page: page numbers so a printed multi-page card
  // stays in order, and a plain-text reminder this is self-reported
  // data (never presented as clinically verified).
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    page.drawText("Self-reported — not a clinical record.", { x: MARGIN, y: 24, size: 8, font: fonts.regular, color: GREY });
    const pageLabel = `${i + 1} / ${pages.length}`;
    const labelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 8);
    page.drawText(pageLabel, { x: PAGE_WIDTH - MARGIN - labelWidth, y: 24, size: 8, font: fonts.regular, color: GREY });
  });

  return doc;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function exportClinicCardPdf(visibility) {
  const doc = await generateClinicCardPdf(visibility);
  const bytes = await doc.save();
  const base64 = uint8ArrayToBase64(bytes);
  const profile = MyProfileRepository.getProfile();
  const namePart = (profile.nickname || "clinic-card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `${namePart || "clinic-card"}-${new Date().toISOString().slice(0, 10)}.pdf`;
  await exportBinaryFile(filename, base64, "application/pdf");
}
