# Ranking Multimidia

The approved replacement for the `/forge` screen. Existing 70/30 media, projects,
routes and renderer files are retained; they are not deleted or migrated.

## Isolation

- Frontend lazily loads `src/modules/ranking-pilot/RankingPilot.jsx` in production mode.
- The two layouts share `RankingComposition.jsx` between preview and export.
- `hfnew-ranking.service` listens only on `127.0.0.1:9007`.
- Only the `/api/ranking/` location is added to the API's Nginx virtual host.
- Identity, permissions and billing reuse the existing Forge entitlement.
- Private data belongs to `<workspace>/ranking`, never to the local pilot folder.
- Signed media links bind the workspace, filename and expiry, including owner files.
- RQ uses the existing persistent queue and global render-capacity lock.
- One ranking render per workspace; maximum montage 180 seconds, ten positions,
  twelve subclips per position, 200 MB per upload, input resolution up to 4096 pixels.
- The renderer runs one concurrent frame worker, H.264/yuv420p and AAC/48 kHz.
- Readiness requires FFprobe compatibility, expected duration and complete FFmpeg decode.
- No paid AI generation occurs in this module.

The installer never restarts `hfnew-api` or a shared Forge worker. It refuses
activation while work is in progress. At the user's request it creates no extra
disk backup; changed integration configuration can be restored from memory if
activation fails. Original media and unrelated services are not removed.

Production begins with empty montages. Demo clips from reference videos are
not uploaded or automatically copied into any workspace. The second layout
accepts independently uploaded interludes through its music/closing panel.

## Validation

```
node --test tests/*.test.mjs
python deploy/ranking/test_ranking.py
npm run build
node tools/ranking-pilot/package-production.mjs
```

`deploy-ranking.ps1` sends the controlled archive and runs the installer. Remote
installation tests both layouts with a synthetic video, checks the actual RQ
worker, unauthenticated 401, font delivery, Nginx syntax, existing API health and
hashes of all unrelated backend modules. Frontend publication is a separate
step, allowed only after `RANKING_DEPLOY=OK`.

The Remotion commercial-use license must be kept appropriate to the business;
this change does not purchase a license or alter the business's licensing.
