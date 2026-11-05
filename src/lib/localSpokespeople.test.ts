import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLocalSpokespeople } from './localSpokespeople';
import { readLocalSpokespeople } from './localSpokespeople.server';

const fixture = readFileSync(new URL('./__fixtures__/local-spokespeople.html', import.meta.url), 'utf8');
describe('published department source', () => {
  it('reads all four actual departments, not national board roles', () => {
    expect(parseLocalSpokespeople(fixture)).toEqual([
      { name: 'Dhr. J. (Joachim) Helms', department: 'Amsterdam', email: 'Amsterdam@coffeeshopbond.nl' },
      { name: 'H. (Hannes) Poppinghaus', department: 'Arnhem', email: 'Arnhem@coffeeshopbond.nl' },
      { name: 'T. (Tugrulhan) Akca', department: 'Enschede', email: 'Enschede@coffeeshopbond.nl' },
      { name: 'Dhr. M. (Michel) Wouters', department: 'Rotterdam', email: 'Rotterdam@coffeeshopbond.nl' },
    ]);
  });
  it('refuses empty and ambiguous sources rather than inventing data', () => {
    expect(() => parseLocalSpokespeople('<html>Offline</html>')).toThrow();
    expect(() => parseLocalSpokespeople(fixture.replace('Woordvoerder Rotterdam', 'Woordvoerder Arnhem'))).toThrow();
  });
  it('does not treat scripts as source data or invent missing email addresses', () => {
    const result = parseLocalSpokespeople(fixture.replace('mailto:Amsterdam@coffeeshopbond.nl', 'javascript:alert(1)') + '<script>Woordvoerder Test</script>');
    expect(result[0].email).toBeNull();
    expect(result).toHaveLength(4);
  });
  it('rejects unavailable and oversized reads', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    fetch.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    await expect(readLocalSpokespeople()).rejects.toThrow('niet beschikbaar');
    fetch.mockResolvedValueOnce(new Response('x'.repeat(2_000_001), { headers: { 'content-type': 'text/html' } }));
    await expect(readLocalSpokespeople()).rejects.toThrow('te groot');
    fetch.mockRestore();
  });
});