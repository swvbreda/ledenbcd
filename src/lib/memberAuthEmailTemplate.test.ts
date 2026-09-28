import { expect, it } from "vitest";
import { memberAuthEmailTemplate } from "./memberAuthEmailTemplate";

it("uses only the intended Auth redirect and hashed token, without old registration steps", () => {
  expect(memberAuthEmailTemplate).toContain("Bevestig en open mijn ledenportaal");
  expect(memberAuthEmailTemplate).toContain("{{ .TokenHash }}");
  expect(memberAuthEmailTemplate).toContain("{{ .RedirectTo }}#token_hash=");
  expect(memberAuthEmailTemplate).not.toContain("{{ .Token }}");
  expect(memberAuthEmailTemplate).not.toMatch(/account aanmaken|kies.*wachtwoord/i);
});
