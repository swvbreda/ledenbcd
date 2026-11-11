export interface SignupDependencies {
  confirmationEnabled(): Promise<boolean>;
  signUp(email: string, password: string): Promise<{ hasSession: boolean }>;
}
export async function registerAllowedMember(raw: unknown, deps: SignupDependencies) {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  if (typeof input.email !== 'string' || typeof input.password !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim()) || input.password.length < 8)
    return { status: 400, body: { error: 'Vul een geldig e-mailadres en een wachtwoord van minimaal 8 tekens in.' } };
  // Fail closed if provisioning ever turns auto-confirm back on. No allowlist enumeration.
  if (!await deps.confirmationEnabled()) return { status: 503, body: { error: 'Registratie wacht op veilige e-mailbevestigingsinstellingen. Neem contact op met het secretariaat.' } };
  const result = await deps.signUp(input.email.trim().toLowerCase(), input.password);
  if (result.hasSession) throw new Error('Unexpected automatic confirmation');
  return { status: 200, body: { success: true, confirmationRequired: true } };
}
