# TOP 5 extras release

This release adds five optional image/video extras to the existing `anime_5` format,
displayed as TOP 5 (5 to 1). Its extras are stored separately from TOP 3.

Backend sources are in `backend/`; the local source of truth is
`E:\ALLIANCE DARK\ALLIANCE-DARK\backend`. The PowerShell publisher creates a
manifest of the existing files before upload and refuses to install when the
live files differ. The installer saves an on-VPS backup, waits for idle render
capacity, checks API health and authentication, and rolls back on failure.

Validation: `npm test` (174 passing), `npm run build`, and seven backend
TOP 3/TOP 5 tests including real 1080x1920 H.264 exports with three and five
inserts, plus a trimmed microvideo repeated to fill its selected slot.
Three legacy pixel assertions also fail on the unchanged backend in the local
Windows environment; they are not evidence that TOP 3 passed those assertions.
