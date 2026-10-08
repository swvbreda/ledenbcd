/** Inkoopfacturen houden hun kale ID (oude koppelingen); bonnetjes krijgen "receipt:", want Informer-ID's zijn niet uniek over soorten. */
export const reviewKey = (docType: string, id: string | number) => docType === "receipt" ? `receipt:${id}` : String(id);
