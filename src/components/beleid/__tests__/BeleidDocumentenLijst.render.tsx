import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { fetchDocs } = vi.hoisted(() => ({ fetchDocs: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "lid-u" } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => fetchDocs, createServerFn: () => ({}) }));
vi.mock("@/lib/bcdDocumenten.functions", () => ({ getBcdDocumenten: {}, getBcdGemeenten: {} }));

import BeleidDocumentenLijst from "@/components/beleid/BeleidDocumentenLijst";

const g = { gm_code: "GM0363", naam: "Amsterdam" };
const d = (id: string, datum: string | null) => ({ id, titel: `Stuk ${id}`, documentdatum: datum, documentsoort: "Raadsbesluit", gemeente: g, bron_url: `https://bron.nl/${id}` });
const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => fetchDocs.mockReset());
afterEach(cleanup);

describe("BeleidDocumentenLijst", () => {
  it("shows title/date/soort, safe external link, 'Datum onbekend' and loads more with the cursor", async () => {
    fetchDocs
      .mockResolvedValueOnce({ status: "ok", gemeente: g, documenten: [d("a", "2026-03-01"), d("b", null)], volgende_cursor: "c2" })
      .mockResolvedValueOnce({ status: "ok", gemeente: g, documenten: [d("c", "2025-01-01")], volgende_cursor: null });
    wrap(<BeleidDocumentenLijst gemeentenaam="Amsterdam" />);
    const link = (await screen.findByText("Stuk a")).closest("a")!;
    expect(link.getAttribute("href")).toBe("https://bron.nl/a");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(screen.getByText("Datum onbekend")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Meer laden/ }));
    await screen.findByText("Stuk c");
    expect(fetchDocs.mock.calls[1][0]).toEqual({ data: { gemeentenaam: "Amsterdam", cursor: "c2" } });
    expect(screen.queryByRole("button", { name: /Meer laden/ })).toBeNull();
  });

  it("distinguishes technical errors and missing link from truly no publications", async () => {
    fetchDocs.mockResolvedValueOnce({ status: "fout", reden: "niet_geconfigureerd" });
    wrap(<BeleidDocumentenLijst gemeentenaam="X" />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/nog niet ingericht/);
    cleanup();
    fetchDocs.mockResolvedValueOnce({ status: "niet_gekoppeld" });
    wrap(<BeleidDocumentenLijst gemeentenaam="Y" />);
    expect((await screen.findByText(/niet gekoppeld/))).toBeTruthy();
    cleanup();
    fetchDocs.mockResolvedValueOnce({ status: "ok", gemeente: g, documenten: [], volgende_cursor: null });
    wrap(<BeleidDocumentenLijst gemeentenaam="Amsterdam" />);
    await waitFor(() => expect(screen.getByText(/geen openbare publicaties bekend voor Amsterdam/)).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
