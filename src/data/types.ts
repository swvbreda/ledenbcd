export interface UboEntry {
  naam: string;
  kvk?: string | null;
  niveau?: number;
  soort?: string;
  uiteindelijkBelanghebbende?: boolean;
  toelichting?: string | null;
}

export interface Location {
  naam: string;
  plaats?: string;
  stadsdeel?: string;
  adres?: string;
  postcode?: string;
  oprichtingsDatum?: string;
  kvk?: string;
  vergunninghouder?: string;
  exploitant?: string;
  ubo?: UboEntry[];
}


export interface Contact {
  naam: string;
  functie: string;
  telefoon: string;
  email: string;
  verjaardag?: string;
}

export interface Member {
  id: number;
  naam: string;
  plaats: string;
  stadsdeel: string;
  jarenLid: number | null;
  oprichtingJaar: number | null;
  oprichtingsDatum?: string;
  contactpersoon: string;
  functie: string;
  telefoon: string;
  email: string;
  bedrijfsnaam: string;
  aantalLocaties: number;
  locaties: Location[];
  contacten: Contact[];
  kvk?: string;
  factuurEmail?: string;
  factuurBedrijfsnaam?: string;
  factuurKvk?: string;
  factuurAdres?: string;
  factuurPostcode?: string;
  factuurPlaats?: string;
  factuurTelefoon?: string;
  contactpersoon2?: string;
  functie2?: string;
  telefoon2?: string;
  email2?: string;
  lidSinds?: number | null;
  lidJaren?: number[];
  contactpersonen?: string[];
  website?: string;
  instagram?: string;
  facebook?: string;
  googleMaps?: string;
  bestuursfunctie?: string;
  oprichter?: boolean;
  aanverwant?: number[];
  ibans?: string[];
}
