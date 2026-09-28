# Project architecture decisions

- Use route-level `head()` and `src/lib/socialHead.ts` for social previews, keeping private route images mapped to the public login capture; this prevents disclosure while enabling unique initial-HTML metadata.
