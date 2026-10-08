# Project architecture decisions

- Use route-level `head()` and `src/lib/socialHead.ts` for social previews, keeping private route images mapped to the public login capture; this prevents disclosure while enabling unique initial-HTML metadata.
- Member passwordless access uses Supabase Auth OTP and an independent server activation switch; this prevents the preview UI alone from enabling live mail before RLS and Auth templates are ready.
- Component render tests live in src/components/**/__tests__/*.render.tsx and run via `bunx vitest run -c vitest.components.config.ts`; the app Vite config loads React twice under vitest.
