const STORAGE_KEY = "bcd-archived-members";

export const getArchivedIds = (): number[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const archiveMember = (id: number) => {
  const ids = getArchivedIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }
};

export const restoreMember = (id: number) => {
  const ids = getArchivedIds().filter((x) => x !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
};

export const isArchived = (id: number): boolean => {
  return getArchivedIds().includes(id);
};
