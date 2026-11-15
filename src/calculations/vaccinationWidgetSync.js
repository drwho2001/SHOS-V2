// vaccinationWidgetSync.js
//
// PLAIN-LANGUAGE PURPOSE
// ----------------------
// The glue between VaccinationRepository's real records and the Vaccination
// home-screen widget (VaccinationWidgetProvider). Same split every other
// sync file already established: the calculation stays pure in the
// repository, this file is the one place that reads real data and decides
// what to push to the widget.
//
// Called from syncAllWidgets() on Home mount, so the widget always
// reflects reality — not conditional on any reminder being due.
//
// Deliberately self-sufficient: called with no argument it derives its own
// data, and the caller never needs to know what this widget shows.

import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";
import { getWidgetBridge } from "./widgetBridge";
import { redactedWidgetLine } from "./widgetPrivacy";

export async function updateVaccinationWidget() {
  try {
    const bridge = await getWidgetBridge();
    if (bridge && bridge.plugin.updateVaccination) {
      const vaccinations = await VaccinationRepository.getAll();
      // Only real vaccinations (not archived, with a date)
      const real = vaccinations.filter(
        (v) => !v.isArchived && v.date && new Date(v.date) <= new Date(),
      );

      if (real.length > 0) {
        // Most recently logged vaccination
        const mostRecent = [...real].sort(
          (a, b) => new Date(b.date) - new Date(a.date),
        )[0];
        const nextDueRelative = mostRecent.nextDue || "—";
        const doseCount = mostRecent.doses ? mostRecent.doses.length : 1;

        await sendWidgetUpdate(bridge, "vaccination", "updateVaccination", {
          vaccineName: mostRecent.vaccine || "Vaccination",
          nextDueRelative,
          doseCount,
          category: "Vaccination",
          state: nextDueRelative === "—" ? "logged" : "due",
        },
          vaccinationRedactedLine(mostRecent.vaccine));
      } else {
        await sendWidgetUpdate(bridge, "vaccination", "updateVaccination", {
          vaccineName: "Vaccination",
          nextDueRelative: "—",
          doseCount: 0,
          category: "Vaccination",
          state: "none",
        },
          vaccinationRedactedLine(null));
      }
    }
  } catch (e) {
    console.warn("Vaccination widget update skipped:", e);
  }
}

// Redacted line: category only at Redacted tier, never a date or vaccine name.
export function vaccinationRedactedLine(vaccineName) {
  return redactedWidgetLine("Vaccination", vaccineName ? "dose logged" : "none logged");
}
