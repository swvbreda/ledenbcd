import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import BudgetCategoryTable from "../BudgetCategoryTable";

afterEach(cleanup);
const cat = { id: "c", year: 2026, name: "Algemene kosten", sort_order: 0, line_items: [
  { id: "l", category_id: "c", name: "Bankkosten", budgeted_amount: 300, sort_order: 0,
    expenses: [{ id: "e", line_item_id: "l", description: null, amount: 100, direction: "out" } as never] },
] };
const handlers = { onAddLineItem: vi.fn(), onUpdateLineItem: vi.fn(), onDeleteLineItem: vi.fn(), onDeleteCategory: vi.fn(), onOpenExpenses: vi.fn() };

describe("BudgetCategoryTable", () => {
  it("2026-standaard: bewerkknoppen en uitgaven zichtbaar", () => {
    render(<BudgetCategoryTable category={cat} {...handlers} />);
    expect(screen.getByText("Post toevoegen")).toBeTruthy();
    expect(screen.getByText("Beschikbaar")).toBeTruthy();
    expect(screen.queryByTitle("Nog geen realisatie opgenomen")).toBeNull();
  });
  it("concept: geen bewerkknoppen, realisatie als streepje", () => {
    render(<BudgetCategoryTable category={{ ...cat, line_items: [{ ...cat.line_items[0]!, expenses: [] }] }} {...handlers} readOnly noRealisation />);
    expect(screen.queryByText("Post toevoegen")).toBeNull();
    expect(screen.queryByText("Categorie verwijderen")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByText("Begrotingsruimte")).toBeTruthy();
    expect(screen.getAllByTitle("Nog geen realisatie opgenomen").length).toBeGreaterThan(0);
  });
});
