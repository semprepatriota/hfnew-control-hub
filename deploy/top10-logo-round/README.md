# Round TOP 10 logo, bottom left

Scope: TOP 10 logo layout only. Preserve the supplied animation, headlines,
scene cuts, music, counters and all other Forge modules.

Existing unversioned configurations migrate once to logo_x=0.12, logo_y=0.9,
logo_round=true, logo_layout_version=1. New configurations start there. Subsequent
size, position and opacity edits remain editable. Public project data and render
validation use the same migration; the installer does not rewrite stored projects.
The preview also normalizes older recovered local drafts.

Use a square circular logo surface with 8% inner padding to protect the artwork.
Preview uses a 50% radius; FFmpeg applies a one-pixel antialiased circular alpha mask.
The five-second animation still loops on the global timeline without adding audio.

Local checks: 145 frontend tests, production build, four logo tests including a
real export, corner alpha checks and loop/scene-boundary image comparisons.
Desktop/mobile preview geometry verified in the browser.
Artifacts: E:/HFNEW-TOP10-TOOLS/round-logo/.

deploy.ps1 opens separately for VPS password input. The installer changes only
services/top10_service.py and services/top10_logo_service.py, checks source hashes,
backs up both files, guards active media processing, waits for healthy API startup,
checks authentication and protected Forge hashes, and rolls back on failure.
Publish the frontend only after TOP10_LOGO_ROUND=OK is confirmed.

If the separate SCP transfer closes unexpectedly, use deploy-single-connection.ps1.
It validates the archive SHA256 and command length locally, sends the small package
inside the same SSH command and runs the identical protected installer. Only one
SSH password prompt is needed. -ValidateOnly performs no remote action.

Previously rendered MP4 files are not modified; export again for the new logo layout.
