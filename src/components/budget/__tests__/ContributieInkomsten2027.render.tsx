import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import ContributieInkomsten2027, { type Scenario } from "../ContributieInkomsten2027";

const staffel = [
  { label: "1 locatie", amount: 3000 }, { label: "2–3 locaties", amount: 4500 }, { label: "4–6 locaties", amount: 6000 },
  { label: "7–10 locaties", amount: 8000 }, { label: "Meer dan 10 locaties", amount: 10000 },
];
const rows = [
  { label: "1 locatie", count: 103, amount: 3000 }, { label: "2–3 locaties", count: 11, amount: 4500 },
  { label: "4–6 locaties", count: 6, amount: 6000 }, { label: "7–10 locaties", count: 1, amount: 8000 },
];
const digits = (s: string | null) => Number((s ?? "").replace(/\D/g, ""));

function Harness() {
  const [s, set] = useState<Scenario>("full");
  return <ContributieInkomsten2027 rows={rows} staffel={staffel} scenario={s} onScenario={set} />;
}

describe("Contributie-inkomsten 2027", () => {
  it("toont 121 leden/groepen (103 + 18) en beide scenario's", () => {
    render(<Harness />);
    expect(screen.getByText(/leden\/groepen in de raming/).textContent).toMatch(/121.*103 met 1 shop.*18 groepen/);
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(402500);
    expect(screen.getByText("Meer dan 10 locaties").closest("tr")?.textContent).toMatch(/0€\s?10\.000€\s?0/);
    fireEvent.click(screen.getByRole("radio", { name: "50% van de verhoging" }));
    expect(digits(screen.getByTestId("contrib-total").textContent)).toBe(382750);
    expect(screen.getByText("2–3 locaties").closest("tr")?.textContent).toMatch(/3\.750/);
  });
});
