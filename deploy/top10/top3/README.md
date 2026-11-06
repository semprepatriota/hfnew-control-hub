# TOP 3 release

This release adds the `top3` format to TOP 10 without changing the other Forge modules.

Backend sources are in `backend/`; the local source of truth is
`E:\ALLIANCE DARK\ALLIANCE-DARK\backend`. The PowerShell publisher creates a
manifest of the existing files before upload and refuses to install when the
live files differ. The installer saves an on-VPS backup, waits for idle render
capacity, checks API health and authentication, and rolls back on failure.

Validation: `npm test` (173 passing), `npm run build`, and three backend TOP 3
tests including a real 1080x1920 H.264 export with image and video inserts.
Three legacy pixel assertions also fail on the unchanged backend in the local
Windows environment; they are not evidence that TOP 3 passed those assertions.
