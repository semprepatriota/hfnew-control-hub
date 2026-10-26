# TOP 10: sem contadores

- `counters_enabled` defaults to true for old and new projects.
- The format selector omits all countdown clips and their audio when false.
- Scene order, trims, individual audio, headlines, logo, CTA and music are retained.
- The preview and export compute contiguous scene frame ranges without counter gaps.
- Switching back preserves the selected counter model; nothing is deleted.
- The timeline groups by scene rather than requiring a counter to exist.
- Export preflight checks only countdown files actually present in the montage.

## Verification

`node --test tests/*.test.mjs` and `npm run build` cover the frontend.
`TOP10_FORMAT_SMOKE=1` enables a real MP4 test with ten trimmed scenes, checking
both sides of every join, exact duration/frame count and the audio frequency of
each scene. All data is synthetic and isolated from production projects.

## Controlled deployment

`tools/package-top10-no-counters.py` packages only `services/top10_service.py`.
The installer validates hashes against the previous verified CTA release, waits
for idle rendering, checks a real MP4 before restart and preserves other modules.
It restores the original code if validation or readiness fails. Existing saved
projects and rendered videos are not rewritten.
