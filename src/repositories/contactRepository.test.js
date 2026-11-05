import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactRepository, DEFAULT_CONTACT, STORAGE_KEY } from './contactRepository';
import { getMissingRequiredContactFields } from '../calculations/contactCalculations.js';

// Mock the storage adapter to use in-memory storage
const mockStore = new Map();

vi.mock('../storage/storageAdapter', () => {
  const mockAdapter = {
    load: vi.fn((key, fallback) => {
      if (mockStore.has(key)) return mockStore.get(key);
      return fallback;
    }),
    save: vi.fn((key, value) => {
      mockStore.set(key, JSON.stringify(value));
      return true;
    }),
  };
  return {
    localStorageAdapter: mockAdapter,
  };
});

describe('ContactRepository Integration', () => {
  beforeEach(async () => {
    // Clear the mock storage before each test
    mockStore.clear();
    vi.clearAllMocks();
    // Pre-populate with empty array to avoid loading seed contacts
    mockStore.set(STORAGE_KEY, []);
    vi.clearAllMocks();
    // Reset the repository's internal cache
    await ContactRepository.__testOnlyReset();
  });

  it('creates and retrieves a contact', async () => {
    const contact = await ContactRepository.create({
      name: 'Test Contact',
      phone: '555-1234',
    });
    
    expect(contact.id).toBeDefined();
    expect(contact.name).toBe('Test Contact');
    expect(contact.phone).toBe('555-1234');
    
    const retrieved = await ContactRepository.getById(contact.id);
    expect(retrieved).toEqual(contact);
  });

  it('backfills new email and weekly-availability fields on older saved contacts', async () => {
    mockStore.set(STORAGE_KEY, [{ id: 'legacy_contact', name: 'Legacy', email: 42, weeklyAvailability: 'bad-shape', availabilityExceptions: null }]);
    await ContactRepository.__testOnlyReset();
    const contact = await ContactRepository.getById('legacy_contact');
    expect(contact.email).toBe('');
    expect(contact.weeklyAvailability).toEqual([]);
    expect(contact.availabilityExceptions).toEqual([]);
    expect(contact.availabilityTimeZone).toBe('');
    expect(contact.outdoorMeetup).toBe(false);
    expect(DEFAULT_CONTACT.weeklyAvailability).toEqual([]);
  });

  it('seeds a representative mix of complete and intentionally incomplete demo contacts', async () => {
    mockStore.delete(STORAGE_KEY);
    await ContactRepository.__testOnlyReset();
    const activeDemos = (await ContactRepository.getAll()).filter((contact) => contact.isDemo && !contact.isArchived);
    const acknowledgedAnonymous = activeDemos.find((contact) => contact.id === 'seed_contact_9014');
    const incompleteExample = activeDemos.find((contact) => contact.id === 'seed_contact_9013');
    const explicitUnknownExample = activeDemos.find((contact) => contact.id === 'seed_contact_9001');

    expect(activeDemos.some((contact) => !contact.markedComplete && getMissingRequiredContactFields(contact).length === 0)).toBe(true);
    expect(acknowledgedAnonymous.markedComplete).toBe(true);
    expect(getMissingRequiredContactFields(acknowledgedAnonymous)).toEqual([]);
    expect(getMissingRequiredContactFields(incompleteExample)).toContain('role');
    expect(getMissingRequiredContactFields(incompleteExample)).toContain('position');
    expect(explicitUnknownExample.bdsmRole).toEqual(['Unknown / not discussed']);
    expect(explicitUnknownExample.sexualPosition).toEqual(['Unknown / not discussed']);
  });

  it('ships a useful demo mix of complete, explicitly unknown, and incomplete contacts', async () => {
    mockStore.delete(STORAGE_KEY);
    await ContactRepository.__testOnlyReset();
    const demos = (await ContactRepository.getAll()).filter((contact) => contact.isDemo && !contact.isArchived);
    const alex = demos.find((contact) => contact.id === 'seed_contact_9001');
    const priya = demos.find((contact) => contact.id === 'seed_contact_9009');
    const ash = demos.find((contact) => contact.id === 'seed_contact_9013');
    const anonymous = demos.find((contact) => contact.id === 'seed_contact_9014');

    expect(getMissingRequiredContactFields(alex)).toEqual([]);
    expect(alex.bdsmRole).toEqual(['Unknown / not discussed']);
    expect(getMissingRequiredContactFields(priya)).toEqual([]);
    expect(getMissingRequiredContactFields(ash)).toContain('role');
    expect(getMissingRequiredContactFields(ash)).toContain('position');
    expect(getMissingRequiredContactFields(anonymous)).toEqual([]);
    expect(anonymous.markedComplete).toBe(true);
  });

  it('updates a contact', async () => {
    const contact = await ContactRepository.create({
      name: 'Original Name',
    });
    
    const updated = await ContactRepository.update(contact.id, {
      name: 'Updated Name',
      phone: '555-9999',
    });
    
    expect(updated.name).toBe('Updated Name');
    expect(updated.phone).toBe('555-9999');
    
    const retrieved = await ContactRepository.getById(contact.id);
    expect(retrieved.name).toBe('Updated Name');
  });

  it('archives and unarchives a contact', async () => {
    const contact = await ContactRepository.create({
      name: 'To Archive',
    });
    
    await ContactRepository.archive(contact.id);
    const archived = await ContactRepository.getById(contact.id);
    expect(archived.isArchived).toBe(true);
    
    await ContactRepository.unarchive(contact.id);
    const unarchived = await ContactRepository.getById(contact.id);
    expect(unarchived.isArchived).toBe(false);
  });

  it('deletes a contact', async () => {
    const contact = await ContactRepository.create({
      name: 'To Delete',
    });
    
    await ContactRepository.delete(contact.id);
    const deleted = await ContactRepository.getById(contact.id);
    expect(deleted).toBeNull();
  });

  it('lists all contacts (archived and active) and filters non-archived', async () => {
    await ContactRepository.create({ name: 'Active 1' });
    await ContactRepository.create({ name: 'Active 2' });
    const archived = await ContactRepository.create({ name: 'Archived' });
    await ContactRepository.archive(archived.id);
    
    const all = await ContactRepository.getAll();
    // getAll returns all contacts including archived
    expect(all.length).toBe(3);
    const nonArchived = all.filter((c) => !c.isArchived);
    expect(nonArchived.length).toBe(2);
    expect(nonArchived.every((c) => !c.isArchived)).toBe(true);
  });
});
