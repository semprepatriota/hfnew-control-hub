# TOP 10 animated logo

Source: `C:/Users/User/Downloads/Design sem nome.mp4`, preserved unchanged.
The provided animation is five seconds, square, with a black background and no audio.
The bundled copy is 720x720 H.264, 30fps, 194269 bytes. No generative changes or background removal.

Existing projects are not silently rebranded. Select **Logo Falcao Zoeira** in
**Titulo e logo** to install a private copy in that project. The existing size,
position, opacity, enable and delete controls remain in charge.

Preview loops the muted video on the global composition clock. Each FFmpeg segment
seeks the logo to its global clock modulo duration, then loops. Existing still logos
keep their image input. Animation audio is never mixed into the exported video.

Verified locally: 144 frontend tests, production build, three logo tests (including a
real H.264/AAC export), pixel comparisons before/after the loop and across segment
boundaries, project isolation, and desktop/mobile browser playback and controls.
Artifacts: `E:/HFNEW-TOP10-TOOLS/animated-logo/`.

Install only the three files in manifest.json. Refuse unrecognized active source,
backup previous files, lock render capacity, refuse active media processing, wait
for API startup, check authentication, preserve other Forge hashes and rollback on
failure. No stored project is edited by the installer.

Run deploy.ps1 in a separate visible PowerShell; password belongs only in its SSH
prompts. Publish matching frontend after TOP10_ANIMATED_LOGO=OK is confirmed.
