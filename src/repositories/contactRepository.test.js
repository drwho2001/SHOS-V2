import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactRepository } from './contactRepository';

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
    mockStore.set('shos_contacts', []);
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