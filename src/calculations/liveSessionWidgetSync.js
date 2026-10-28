import { getWidgetBridge } from "./widgetBridge";
import { sendWidgetUpdate } from "./widgetBridgeUpdate";
import { redactedWidgetLine } from "./widgetPrivacy";
import { SessionRepository } from "../repositories/sessionRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { KinkRegistry } from "../registries/kinkRegistry";
import { sessionTally } from "./sessionTally";

export async function updateLiveSessionWidget() {
  try {
    const bridge = await getWidgetBridge();
    if (!bridge?.plugin?.updateLiveSession) return;

    const active = (await SessionRepository.getActive())[0] || null;
    const encounters = active
      ? (await EncounterRepository.getAll()).filter((encounter) => encounter.sessionId === active.id && !encounter.isArchived)
      : [];
    const kinks = await KinkRegistry.getAll();
    const tally = sessionTally(encounters, { fistingKinkIds: kinks.filter((kink) => kink.name === "Fisting").map((kink) => kink.id) });
    const payload = {
      title: active?.title || "",
      activityCount: tally.activityCount,
      people: tally.people,
      kinks: tally.kinks,
      loads: tally.loads,
      fists: tally.fists,
      category: "Live session",
      state: active ? "active" : "inactive",
    };
    await sendWidgetUpdate(bridge, "liveSession", "updateLiveSession", payload, redactedWidgetLine("Live session", active ? "active" : "inactive"));
  } catch (error) {
    console.warn("Live session widget update skipped:", error);
  }
}

export default updateLiveSessionWidget;
