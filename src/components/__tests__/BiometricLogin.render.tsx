import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import LoginPage from '@/pages/LoginPage';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';

const fixture = vi.hoisted(() => ({
  native: true, user: null as null | { id: string },
  isAvailable: vi.fn(), getCredentials: vi.fn(), setCredentials: vi.fn(),
  verifyIdentity: vi.fn(), deleteCredentials: vi.fn(), signIn: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => fixture.native } }));
vi.mock('@capgo/capacitor-native-biometric', () => ({ NativeBiometric: fixture }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { signInWithPassword: (...args: unknown[]) => fixture.signIn(...args) } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: fixture.user, loading: false, isAdmin: false, isExtern: false, linkedMemberId: 1, mfaStatus: 'verified' }) }));
vi.mock('@/hooks/usePasskeys', () => ({ usePasskeys: () => ({}), isPlatformAuthenticatorAvailable: async () => false }));
vi.mock('@/lib/router-compat', () => ({ Navigate: () => <div>Navigation completed</div> }));
vi.mock('@/lib/ssoRedirect', () => ({ captureRedirectFromQuery: () => {}, hasPendingRedirect: () => false, maybeRedirectAfterLogin: vi.fn() }));
vi.mock('@/lib/postLoginPath', () => ({ consumePostLoginPath: () => null }));
vi.mock('@/lib/memberAccessFlag', () => ({ memberPasswordlessEnabled: false }));
vi.mock('@/lib/memberLogin.functions', () => ({ requestMemberLoginLink: vi.fn() }));

afterEach(() => { cleanup(); vi.resetAllMocks(); fixture.native = true; fixture.user = null; });

describe('native biometric login', () => {
  it('shows Face ID availability and unlocks before the real password-auth call', async () => {
    fixture.isAvailable.mockResolvedValue({ isAvailable: true, biometryType: 2 });
    fixture.getCredentials.mockResolvedValue({ username: 'synthetic@example.invalid', password: 'fixture-password' });
    fixture.verifyIdentity.mockResolvedValue(undefined);
    fixture.signIn.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useBiometricAuth());
    await waitFor(() => expect(result.current.hasCredentials).toBe(true));
    expect(result.current.biometryLabel).toBe('Face ID');
    await act(async () => { expect(await result.current.loginWithBiometric()).toEqual({ success: true }); });
    expect(fixture.verifyIdentity).toHaveBeenCalledOnce();
    expect(fixture.signIn).toHaveBeenCalledWith({ email: 'synthetic@example.invalid', password: 'fixture-password' });
    expect(fixture.verifyIdentity.mock.invocationCallOrder[0]).toBeLessThan(fixture.signIn.mock.invocationCallOrder[0] ?? 0);
  });
  it('does not sign in when biometric verification is cancelled', async () => {
    fixture.isAvailable.mockResolvedValue({ isAvailable: true, biometryType: 2 });
    fixture.getCredentials.mockResolvedValue({ username: 'synthetic@example.invalid', password: 'fixture-password' });
    fixture.verifyIdentity.mockRejectedValue({ message: 'User cancelled' });
    const { result } = renderHook(() => useBiometricAuth());
    await waitFor(() => expect(result.current.isAvailable).toBe(true));
    await act(async () => { expect(await result.current.loginWithBiometric()).toEqual({ success: false }); });
    expect(fixture.signIn).not.toHaveBeenCalled();
  });
  it('never loads the native plugin in an ordinary browser', () => {
    fixture.native = false;
    const { result } = renderHook(() => useBiometricAuth());
    expect(result.current.isAvailable).toBe(false);
    expect(fixture.isAvailable).not.toHaveBeenCalled();
  });
  it('keeps the save offer visible after auth resolves and navigates only after choosing', async () => {
    fixture.isAvailable.mockResolvedValue({ isAvailable: true, biometryType: 2 });
    fixture.getCredentials.mockRejectedValue(new Error('No saved credentials'));
    fixture.setCredentials.mockResolvedValue(undefined);
    fixture.signIn.mockImplementation(async () => { fixture.user = { id: 'synthetic-user' }; return { error: null }; });
    const { container, rerender } = render(<LoginPage />);
    await waitFor(() => expect(fixture.getCredentials).toHaveBeenCalled());
    const email = container.querySelector('input[type=email]');
    const password = container.querySelector('input[autocomplete=current-password]');
    if (!email || !password) throw new Error('Login inputs missing');
    fireEvent.change(email, { target: { value: 'synthetic@example.invalid' } });
    fireEvent.change(password, { target: { value: 'fixture-password' } });
    fireEvent.click(screen.getByRole('button', { name: /^Inloggen$/ }));
    await screen.findByText('Wil je voortaan inloggen met Face ID?');
    rerender(<LoginPage />);
    expect(screen.queryByText('Navigation completed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, activeer' }));
    await screen.findByText('Navigation completed');
    expect(fixture.setCredentials).toHaveBeenCalledWith({ username: 'synthetic@example.invalid', password: 'fixture-password', server: 'leden.coffeeshopbond.nl' });
  });
});