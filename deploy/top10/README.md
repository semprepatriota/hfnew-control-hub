# TOP 10

Isolated editor at `/top-10`: ten reusable counters alternating with ten uploaded scenes.
Backend: `/api/top10`. Workspace-scoped projects, media and export jobs.

## Counter Sources

- Pink 3D: supplied ZIP `forge_max_selecionados_c2de4381.zip`, counters 10 through 3.
- Pink 7: replaced by the corrected `7 (1).mp4` supplied on 2026-10-17.
- Pink 2 and 1: recreated with explicit user authorization; visual approval pending.
- Cinema: all ten original counters from `forge_max_selecionados_4a6f41ef`.
- Original files remain unchanged. Per-file source/output hashes are stored in the asset provenance JSON.
- Counter timing is frame-based at 30 FPS. Frontend and backend share the packaged catalog.

## Validation And Deployment

Run `npm test` and `npm run build` for the frontend.
Backend tests include real MP4 generation, authenticated media protection, workspace isolation,
revision conflicts, and exact metadata checks for all twenty counters.
Full ten-scene videos using each counter model are tested locally. The VPS installer
skips those heavy exports and checks all twenty packaged media files and security
contracts without adding another render workload to the production host.

`tools/package-top10.py` builds a hash-verified backend archive from the dedicated backend source.
`deploy-top10.ps1` uploads it and runs `install.py` on the VPS.
The installer patches only named integration points, preserves the existing Forge files,
waits for idle render capacity, runs tests, and keeps a rollback backup before restarting.
Frontend publication is a separate GitHub Pages deployment.

Existing production Forge modules and their assets are outside this module's ownership.
