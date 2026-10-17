# TOP 10

Isolated editor at `/top-10`: up to ten reusable counters alternating with the populated scene slots.
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

## Optional Per-Scene Headlines

Every scene defaults to `headline.enabled=false`. Empty or disabled captions add no image
to the MP4. Saving/rendering never calls OpenAI. Text and opaque cover placement are
independent for every scene; reordering a scene moves its caption with it.

The explicit Hook + CTA action samples three frames within the saved trim, after applying
the same crop as the final render. It reuses the configured ChatGPT credentials/model,
but supplies a dedicated comedy prompt, never the political/editorial prompt of Forge 70/30.
It returns the original caption, faithful Brazilian-Portuguese translation, a separate
comedy Hook + CTA, and suggested original-text coordinates. Translation is used first
when it fits the 400-character field; longer translations remain available for review.
This is sampled visual reading, not full-video transcription or guaranteed detection of
every changing subtitle. The user reviews and explicitly enables the scene caption.

Preview and export use the same immutable full-resolution PNG, integer coordinates and
font fit. A scene caption replaces the optional global title on that scene only. Counters
never receive scene captions. Request IDs deduplicate successful generation requests;
provider failures are reported, never replaced with an unrelated generic headline.
