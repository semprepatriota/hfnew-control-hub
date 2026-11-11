# Forge Max to TOP 10/5/3 bridge

The Forge Max extracted-clips toolbar offers three explicit destinations. The
TOP 10 import preserves its original behavior. TOP 5 imports up to five clips
into slots 5-9 with `format=anime_5`; TOP 3 imports up to three clips into
slots 7-9 with `format=top3`. Anime images and scene extras remain optional.

The import validates clip readiness, workspace ownership, duration, size,
distinct IDs and per-format limits before creating a project. Source clips
remain in Forge Max. An import failure removes only the new TOP project.

Run `npm test`, `npm run build`, and `python run_bridge_tests.py` from this
release directory. The focused backend suite includes the three prior import
regressions and four destination-format tests. It requires the local backend at
`E:\ALLIANCE DARK\ALLIANCE-DARK\backend` and its virtual environment.

`publish.ps1` packages only `routes/top10.py` and
`services/top10_forge_max_bridge.py`. The installer verifies hashes against
the live VPS files, waits for idle render capacity, saves a backup, checks
protected Forge file hashes, restarts the API and verifies auth. It rolls back
if validation after copying fails. Frontend publication is a separate push to
GitHub Pages.
