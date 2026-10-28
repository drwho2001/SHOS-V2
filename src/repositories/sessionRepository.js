import { localStorageAdapter as storage } from "../storage/storageAdapter.js";
import { EncounterRepository } from "./encounterRepository.js";

const STORAGE_KEY = "shos_sessions";

export const DEFAULT_SESSION = {
  isDemo: false,
  title: "",
  startAt: "",
  endAt: "",
  status: "active",
  attendeeIds: [],
  notes: "",
  isArchived: false,
};

let sessions = null;
let nextNumber = null;
let loadPromise = null;

export const SEED_SESSION_IDS = new Set();

async function ensureLoaded() {
  if (sessions === null) {
    if (!loadPromise) loadPromise = storage.load(STORAGE_KEY, []);
    sessions = await loadPromise;
    nextNumber = computeNextNumber(sessions);
  }
  return sessions;
}

function computeNextNumber(existing) {
  const numbers = existing.map((e) => {
    const match = /^session_(\d+)$/.exec(e.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `session_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

async function persist() {
  await storage.save(STORAGE_KEY, sessions);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("shos-session-changed"));
}

export const SessionRepository = {
  async getAll() {
    await ensureLoaded();
    return structuredClone(sessions.map((s) => ({ ...DEFAULT_SESSION, ...s })));
  },

  async getById(id) {
    await ensureLoaded();
    const found = sessions.find((s) => s.id === id);
    return found ? structuredClone({ ...DEFAULT_SESSION, ...found }) : null;
  },

  async getActive() {
    return (await this.getAll())
      .filter((s) => !s.isArchived && s.status === "active")
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 1);
  },

  async create(data) {
    await ensureLoaded();
    const startAt = data.startAt || new Date().toISOString();
    if ((data.status || DEFAULT_SESSION.status) === "active") {
      // A live widget needs one unambiguous current session. Starting a new one
      // explicitly closes the previous live session at the new session start.
      sessions = sessions.map((s) => s.status === "active" && !s.isArchived
        ? { ...s, status: "closed", endAt: startAt, updatedAt: new Date().toISOString() }
        : s);
    }
    const newSession = {
      ...DEFAULT_SESSION,
      ...data,
      startAt,
      isDemo: false,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    sessions = [...sessions, newSession];
    await persist();
    return newSession;
  },

  async update(id, changes) {
    await ensureLoaded();
    let updated = null;
    sessions = sessions.map((s) => {
      if (s.id !== id) return s;
      updated = { ...s, ...changes, updatedAt: new Date().toISOString(), isDemo: s.isDemo };
      return updated;
    });
    await persist();
    return updated ? structuredClone({ ...DEFAULT_SESSION, ...updated }) : null;
  },

  async archive(id) {
    return this.update(id, { isArchived: true });
  },

  async unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  async delete(id) {
    await ensureLoaded();
    await EncounterRepository.unlinkSession(id);
    sessions = sessions.filter((s) => s.id !== id);
    await persist();
  },

  async restore(record) {
    await ensureLoaded();
    if (sessions.some((s) => s.id === record.id)) return;
    sessions = [...sessions, record];
    await persist();
  },

  async replaceAll(newSessions) {
    sessions = newSessions;
    nextNumber = computeNextNumber(sessions);
    await persist();
  },
};
