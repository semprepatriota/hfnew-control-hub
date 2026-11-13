# TOP 3 single-scene extra release

An extra image or video now plays immediately after its own TOP 3 scene, even
when no following numbered scene is present. TOP 5 and classic TOP 10 are unchanged.

Backend sources are in `backend/`; the local source of truth is
`E:\ALLIANCE DARK\ALLIANCE-DARK\backend`. The PowerShell publisher creates a
manifest with the previous service hash before upload and refuses to install when
the live file differs. Only `services/top10_service.py` is installed. The installer
saves an on-VPS backup, waits for idle render
capacity, checks API health and authentication, and rolls back on failure.

Validation: `npm test` (175 passing), `npm run build`, and eight focused backend
TOP 3/TOP 5 tests. The real 1080x1920 MP4 test includes one scene, one extra,
logo, and music. The broader legacy backend suite still has environment-specific
failures unrelated to this change; do not represent it as fully green.
