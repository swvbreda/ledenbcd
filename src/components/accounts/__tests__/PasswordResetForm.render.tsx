import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PasswordResetForm } from "../PasswordResetForm";

afterEach(cleanup);
function fill(password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText("Nieuw wachtwoord"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Bevestig wachtwoord"), { target: { value: confirmation } });
  fireEvent.click(screen.getByRole("button", { name: "Wachtwoord opslaan" }));
}
describe("password reset", () => {
  it("does not submit short or mismatched passwords", () => {
    const onSave = vi.fn();
    render(<PasswordResetForm onSave={onSave} onSuccess={vi.fn()} />);
    fill("short");
    expect(onSave).not.toHaveBeenCalled();
    fill("long-enough", "different");
    expect(onSave).not.toHaveBeenCalled();
  });
  it("keeps a rejected reset open and permits a corrected submission", async () => {
    const onSave = vi.fn().mockResolvedValueOnce({ error: { message: "non-2xx" } }).mockResolvedValueOnce({ error: null, data: { success: true } });
    const onSuccess = vi.fn();
    render(<PasswordResetForm onSave={onSave} onSuccess={onSuccess} />);
    fill("fixture-password");
    await screen.findByRole("alert");
    expect(onSuccess).not.toHaveBeenCalled();
    fill("corrected-fixture-password");
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenLastCalledWith("corrected-fixture-password");
  });
  it("does not report success when a request throws", async () => {
    const onSuccess = vi.fn();
    render(<PasswordResetForm onSave={vi.fn().mockRejectedValue(new Error("offline"))} onSuccess={onSuccess} />);
    fill("fixture-password");
    await screen.findByRole("alert");
    expect(onSuccess).not.toHaveBeenCalled();
    expect((screen.getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
});