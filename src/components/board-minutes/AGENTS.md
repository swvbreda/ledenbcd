# Board minutes rules

- Historical bulk adoption previews the full latest-version set and submits it once to an admin-checked transactional RPC that delegates to existing adoption; this avoids partial corrections and detects concurrent archive changes.
- Adoption records current administrator confirmation time and instruction origin, never inferred historic dates; display adoption status independently from document completeness to avoid presenting agendas as minutes.
- Concept imports derive attendance from explicitly labelled metadata and fingerprint the text plus both original files; corrections append under the same source identity without adoption, while display hides only the exact legacy application preamble and keeps source bytes immutable.