import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
afterEach(cleanup);
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { CheckpointTable, SimplePost } from "../ProjectWorkspace";

describe("SimplePost", () => {
  it("houdt tekst vast bij fout en wist pas na bevestigd succes", () => {
    const onPost = vi.fn();
    render(<SimplePost label="Nieuw bericht" busy={false} onPost={onPost} />);
    const box = screen.getByLabelText("Nieuw bericht") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "Hallo" } });
    fireEvent.click(screen.getByRole("button", { name: "Plaatsen" }));
    expect(onPost).toHaveBeenCalledTimes(1);
    expect(box.value).toBe("Hallo"); // nog niet bevestigd (bijv. fout)
    const done = onPost.mock.calls[0][1] as () => void;
    done();
    expect(box.value).toBe("");
  });
  it("verstuurt niet tijdens pending", () => {
    const onPost = vi.fn();
    const { rerender } = render(<SimplePost label="Nieuw bericht" busy={false} onPost={onPost} />);
    fireEvent.change(screen.getByLabelText("Nieuw bericht"), { target: { value: "x" } });
    rerender(<SimplePost label="Nieuw bericht" busy onPost={onPost} />);
    fireEvent.submit(screen.getByRole("button", { name: "Plaatsen" }).closest("form")!);
    expect(onPost).not.toHaveBeenCalled();
  });
});

describe("CheckpointTable", () => {
  const row = { id: "c1", position: 1, title: "Contract", status: "open" as const, owner_id: null, due_date: null, remarks: null, updated_by: null, updated_at: "x" };
  it("Opmerkingen is laatste kolom en verwijderen staat bij de titel", () => {
    render(<CheckpointTable rows={[row]} loading={false} error={null} staff={[]} busy={false} onMut={vi.fn()} />);
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads[heads.length - 1]).toBe("Opmerkingen");
    const del = screen.getByRole("button", { name: "Controlepunt verwijderen: Contract" });
    expect(del.closest("td")!.querySelector("input")).toBeTruthy();
  });
  it("nieuw controlepunt blijft staan tot opslaan bevestigd is", () => {
    const onMut = vi.fn();
    render(<CheckpointTable rows={[]} loading={false} error={null} staff={[]} busy={false} onMut={onMut} />);
    const inp = screen.getByPlaceholderText("Nieuw controlepunt") as HTMLInputElement;
    fireEvent.change(inp, { target: { value: "Offerte" } });
    fireEvent.submit(inp.closest("form")!);
    expect(inp.value).toBe("Offerte");
    onMut.mock.calls[0][0].done();
    expect(inp.value).toBe("");
  });
});
