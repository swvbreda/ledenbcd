import { describe,it,expect } from "vitest";
import { sharesInvoiceNumber, isSamePayment } from "@/lib/ledgerDedupe";
const l={date:"2026-03-01",amount:1000,counterparty:"Leverancier B.V.",description:"Advies",invoice:"20260100",direction:"out"};
const p={date:"2026-03-01",amount:1000,counterparty:"Leverancier B.V.",description:"Advies",invoice:null,direction:"out"};
it("x",()=>{console.log(sharesInvoiceNumber(l as any,p as any), isSamePayment(l as any,p as any));expect(1).toBe(1)});
