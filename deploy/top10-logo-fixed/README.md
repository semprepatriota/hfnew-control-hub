# Lock the approved TOP 10 logo

Keep the circular animated logo at x=0.12, y=0.9, size=0.14, opacity=1.
No artwork, alpha mask, animation, scene, headline or audio change.
Remove only the logo size/position/opacity sliders; enable, replace and delete stay.

Frontend normalizes both saved configurations and recovered drafts. Backend
validation enforces the same values for all saves and exports, including old clients.
Existing rendered MP4 files remain unchanged.

Package changes only services/top10_service.py, with baseline hash verification,
backup/rollback, idle/render-capacity protection, API startup wait, authentication
verification and protected hashes for the logo compositor and other Forge modules.
Use deploy.ps1: one SSH connection and one password, no separate SCP transfer.
Publish the frontend only after TOP10_LOGO_FIXED=OK is confirmed.
