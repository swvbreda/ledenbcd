export interface Location {
  naam: string;
  plaats?: string;
  stadsdeel?: string;
  adres?: string;
  postcode?: string;
}

export interface Contact {
  naam: string;
  functie: string;
  telefoon: string;
  email: string;
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
  website?: string;
  instagram?: string;
  facebook?: string;
  googleMaps?: string;
}
