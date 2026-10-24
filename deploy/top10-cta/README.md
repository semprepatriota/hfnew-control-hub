# TOP 10: headline margins and subscription CTA

Scope: TOP 10 only. No Ranking, Forge Max, Forge 50/50, or Jesus Te Ama code/data
is modified. The installer changes only the five paths listed in `NAMES` and
refuses an active-source hash that differs from the read-only live audit.

- The existing headline PNG keeps its text/font contract, with transparent
  4% side margins and a 1.5% output-height lift (29 px at 1080x1920).
- Preview and renderer apply the same non-accumulating Y offset. Painter cache
  version 3 refreshes the bitmap without calling OpenAI or replacing its text.
- Subscribe PNG is copied byte-for-byte from the active Jesus Te Ama release
  `20261020205830-ready-video-logo-subscribe`. SHA256:
  `aab18263d1bb07e49cf7384b4512a1f89a84a286b4121727ddf3c6f79d4c17e5`.
- That app has a bell, not a thumbs-up. The new thumbs-up uses the installed
  Lucide ThumbsUp icon in a matching blue badge; the Jesus Te Ama app is untouched.
- The original timing rule is reused: one silent appearance, up to three seconds,
  in the lower safe center. It can be disabled independently of the logo.
- Integer-frame timestamps and even chroma coordinates preserve timing across
  separately encoded scenes/counters. HD BT.709 conversion keeps PNG colors
  stable after export; no second whole-video encoding pass is added.
- Existing locked circular logo coordinates, duration and audio remain unchanged.

Validation: frontend unit suite, Python raster/timing tests, an actual two-scene
export with/without CTA, full decode, audio comparison, and nine browser-preview
versus browser-decoded-MP4 frame pairs. Production repeats the synthetic MP4 test
before restarting the API. Activation is refused while FFmpeg or RQ is busy.

The local QA API and HTML use only disposable data under
`E:\HFNEW-TOP10-TOOLS\headline-cta`, never real user projects or credentials.
