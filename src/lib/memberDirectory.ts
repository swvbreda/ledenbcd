/**
 * Samenvoegen van de eigen (volledige) ledenrijen met de geschoonde
 * ledendirectory die gewone leden van de database krijgen.
 *
 * De eigen rij heeft altijd voorrang, zodat een lid de eigen gegevens volledig
 * ziet en andere leden uitsluitend geschoond. Ieder lidnummer komt één keer voor.
 */
export interface DirectoryRow {
  id: number;
  member_type: string;
  data: unknown;
}

export interface DirectoryAccessInput {
  isAdmin: boolean;
  isBoard: boolean;
  isExtern: boolean;
  isInhuur: boolean;
  linkedMemberIds: number[];
}

export interface DirectoryAccess {
  /** Bestuur en beheer lezen het volledige ledenbestand rechtstreeks. */
  canReadAll: boolean;
  /** Gewone leden met geldige koppeling krijgen de geschoonde directory. */
  canUseDirectory: boolean;
}

export function directoryAccess(input: DirectoryAccessInput): DirectoryAccess {
  const canReadAll = input.isAdmin || input.isBoard;
  return {
    canReadAll,
    canUseDirectory:
      !canReadAll && !input.isExtern && !input.isInhuur && input.linkedMemberIds.length > 0,
  };
}

export function mergeDirectory<T extends DirectoryRow>(ownRows: T[], directoryRows: T[]): T[] {
  const byId = new Map<number, T>();
  for (const row of directoryRows) byId.set(row.id, row);
  for (const row of ownRows) byId.set(row.id, row);
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}
