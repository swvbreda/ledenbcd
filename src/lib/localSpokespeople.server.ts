import { parseLocalSpokespeople, SPOKESPEOPLE_SOURCE } from './localSpokespeople';

export async function readLocalSpokespeople() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(SPOKESPEOPLE_SOURCE, { signal: controller.signal, redirect: 'error', headers: { Accept: 'text/html' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html') || !response.body) throw new Error('Woordvoerdersbron niet beschikbaar');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '', size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2_000_000) throw new Error('Woordvoerdersbron is te groot');
        html += decoder.decode(chunk.value, { stream: true });
      }
      html += decoder.decode();
      return { people: parseLocalSpokespeople(html), source: SPOKESPEOPLE_SOURCE };
    } finally { await reader.cancel(); }
  } finally { clearTimeout(timeout); }
}