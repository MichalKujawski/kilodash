# Release audit

_2026-10-05, commit `881246f` (tag `pre-release-backup`). No changes have been made except this file._

Severity: **Blocker** (must fix before publishing) · **Should fix** · **Nice to have**.

## Summary

The product is in good shape. A fresh clone builds and passes everything, there are no secrets, the
dependencies are clean and permissive, and Lighthouse targets are met. The blockers are all about
**git history and identity**, not the code:

1. **Large history:** ~246 MB of old screenshots in history.
2. **Private email:** your private Gmail address is on all 49 commits.
3. **Docs required by the release brief are missing.**

Nothing has been pushed anywhere yet (there is no remote), so cleaning the history now carries no
risk to any published repository.

## Repository content

| #   | Finding                                                                                                                                                                                             | Severity            | Proposed fix                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `.git` is 252 MB (pack 235 MiB). 206 MB of history is `docs/screenshots/` (every pose re-committed after each visual change) and 40 MB is `docs/design/`. The working tree alone is ~90 MB of PNGs. | **Blocker**         | Rewrite history to drop old screenshot blobs (§ History strategy). Keep a curated set of screenshots as optimized WebP (target: docs images < 5 MB in total).                                                               |
| R2  | All 49 commits use `MichalKujawski <m.kujawski2255@gmail.com>` (a private address).                                                                                                                 | **Blocker**         | Rewrite author and committer to your GitHub noreply address during the history rewrite; set it as the repo's `user.email` from then on. **Needs your GitHub noreply address** (`<id>+<username>@users.noreply.github.com`). |
| R3  | Secret scan (gitleaks v8.30.1, all branches, 49 commits): **no leaks found**. No `.env` committed (only `.env.example`). No absolute paths or emails in any file, current or historical.            | OK                  | —                                                                                                                                                                                                                           |
| R4  | Branch `wip/elm327-scan`: ELM327 client/emulator plus "OBDb signalsets" (1,500 lines, not wired into the UI). The signalsets are third-party data whose license I haven't verified.                 | Should fix          | Don't publish this branch: keep it local, or archive it as a bundle file next to the backup.                                                                                                                                |
| R5  | Big videos (`media/`, 35 MB) are correctly kept out of git. README loops: 60–100 KB each; README WebP 1.1 MB; `public/og.png` 1.1 MB.                                                               | Nice to have        | Re-encode `og.png` as an optimized PNG or JPEG (< 300 KB). Upload the videos as release assets and to YouTube.                                                                                                              |
| R6  | `src/app/lazy.ts` still declares a lazy Landing that is never used (the build warns "ineffective dynamic import").                                                                                  | Should fix          | Remove the leftover declaration.                                                                                                                                                                                            |
| R7  | `src/core/world/demo.drive.test.ts` prints debug logs (`console.log`). No `console.*` in shipped code. No TODO/FIXME anywhere.                                                                      | Nice to have        | Remove the debug prints.                                                                                                                                                                                                    |
| R8  | Unit tests print a Node 26 `ExperimentalWarning` (built-in localStorage without a file).                                                                                                            | Nice to have        | Silence it in the Vitest config (`--no-experimental-webstorage` or `--localstorage-file`).                                                                                                                                  |
| R9  | `depcheck`: no unused or missing dependencies. `npm audit`: 0 vulnerabilities (production and dev).                                                                                                 | OK                  | —                                                                                                                                                                                                                           |
| R10 | Root has 20 entries (15 visible); the brief targets ≤ 12.                                                                                                                                           | Nice to have        | Move process files into `docs/process/` (see Process files); the configs have to stay at the root.                                                                                                                          |
| R11 | Experimental themes (7) and the theme editor exist only behind `?dev=1`, labelled "Experimental — not contract-complete".                                                                           | Should fix (decide) | Option 1: keep them and document them as an experiment (they demonstrate ADR 5, "themes as data"). Option 2: remove them (≈ 1,300 lines) for a tighter repo. Recommendation: keep and document.                             |
| R12 | `docs/screenshots/` (47 images) are pre-3D-map kiosk poses and partly stale; `docs/design/` holds 51 images (audit, concepts, progress).                                                            | Should fix          | Keep the design story (audit before, chosen concept, final screens at 1440 and 1920, phone); delete the rest; convert to WebP.                                                                                              |

## Third-party and IP

| #   | Finding                                                                                                                                                                                                                                                                                                                        | Severity      | Proposed fix                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| I1  | Internal identifier **`autopilot`** (demo driver on/off) appears in about 15 places in the code and tests. Visitors see "Demo drive", but "Autopilot" is Tesla's feature name.                                                                                                                                                 | Should fix    | Rename it to `demoDrive` / `setDemoDrive` (no behaviour change).                                                     |
| I2  | `docs/features/drive-modes.md` names VW group, BMW, Mercedes, Hyundai/Kia and Volvo as the basis for the behaviour.                                                                                                                                                                                                            | Should fix    | Say "mainstream European and Korean cars since about 2015".                                                          |
| I3  | `docs/briefs/realism-v2.md` (your brief) mentions AdBlue.                                                                                                                                                                                                                                                                      | Should fix    | Replace it with "diesel exhaust fluid" when the briefs move to `docs/process/`. Needs your OK, since it's your text. |
| I4  | No manufacturer logos or real-cluster reference images anywhere. All images are this project's own renders. Telltale icons are original drawings following the ISO 2575 symbol conventions (a public standard). Sounds are synthesized with Web Audio. Map content is generated procedurally (no tiles, no map data provider). | OK            | Say so in `THIRD_PARTY_NOTICES.md` and `HMI_AND_SAFETY.md`.                                                          |
| I5  | Place names (A 7, Nordhausen, Waldheim, Neustadt, Bahnhofstraße) are real German geography used as a fictional route.                                                                                                                                                                                                          | OK (low risk) | Mention "fictional route with real-sounding names" in the docs.                                                      |
| I6  | Licenses. Production: react, react-dom, scheduler, loose-envify, js-tokens (MIT). Fonts: Inter and Barlow Semi Condensed (SIL OFL 1.1, attribution and license text required). Dev dependencies: build tools only, not shipped.                                                                                                | Should fix    | Add a generated `THIRD_PARTY_NOTICES.md` (script) with the OFL text.                                                 |
| I7  | Name: **Kilodash** (renamed today). Web search found no software product of that name, only a designer's handle, an old working name in a small Raspberry Pi project and a crypto unit (kDASH).                                                                                                                                | OK            | Check the npm package name and the GitHub repo name when creating them.                                              |

## Quality and reliability

| #   | Finding                                                                                                                                                                                                                                            | Severity   | Proposed fix                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| Q1  | Clean-clone test (Node 26.8.1): `git clone` → `npm ci` 2.4 s → `lint` 7.3 s → `typecheck` 5.8 s → `test` 7.8 s (249 tests) → `build` 6.7 s → `playwright test` 43.5 s (16 tests, includes build and preview). **All pass, no undocumented steps.** | OK         | Document the Node version (`.nvmrc` / `engines`).                                         |
| Q2  | Flakiness: unit and browser tests three times each, **all green every time**.                                                                                                                                                                      | OK         | —                                                                                         |
| Q3  | CI: the workflow exists but has never run (no remote).                                                                                                                                                                                             | Should fix | First push → check it's green. Add Firefox/WebKit and a post-deploy smoke test.           |
| Q4  | Firefox: 15/16 pass. The handover test fails on an over-tight distance limit (16 m, limit 15 m at ~125 km/h, because Firefox clicks more slowly). A test problem, not a product bug.                                                               | Should fix | Make the limit depend on speed × elapsed time.                                            |
| Q5  | WebKit/Safari: can't run locally (system libraries missing on this Arch machine; installing them needs sudo).                                                                                                                                      | Should fix | Run WebKit in CI (Ubuntu, `--with-deps`); real iPhone and Android checks are owner steps. |
| Q6  | Lighthouse (production build, today). Desktop: 99–100 performance, 100 accessibility / best practices / SEO (Watch, Drive, Engineer). Mobile (4× CPU, slow 4G): performance 90–97, others 100.                                                     | OK         | Record in `PROJECT_STATS.md` via script.                                                  |
| Q7  | First load: 160 KB gzip JS + CSS (480 KB raw main bundle), 161 KB fonts (woff2), `dist` 2.2 MB in total. Cockpit moving after 0.25–0.5 s (production build, desktop).                                                                              | OK         | —                                                                                         |
| Q8  | Real devices (Android, iPhone) and Safari not tested.                                                                                                                                                                                              | Should fix | Owner step in the launch checklist; `docs/COMPATIBILITY.md` lists what was tested where.  |

## Docs required by the release brief

Present: `WALKTHROUGH`, `PRIVACY`, `UX_TESTING`, `VIDEO_SCRIPT`, 20 feature docs, 6 ADRs, `LICENSE` (MIT, "Michal Kujawski", 2026).
**Missing:**

- in `docs/`: `README` (index), `ARCHITECTURE`, `HMI_AND_SAFETY`, `RISKS_AND_LIMITATIONS`, `DEMO_SCRIPT`, `FEATURE_INVENTORY`, `MENU_SYSTEM`, `CONTROLS`, `SIGNALS`, an ADR index, `COMPATIBILITY`, `PROJECT_STATS`, `INTERVIEW_PREP`, `CV_AND_LINKEDIN`, `LAUNCH_CHECKLIST`;
- at the root: `CHANGELOG`, `THIRD_PARTY_NOTICES`, `CONTRIBUTING`, `SECURITY`, `CODE_OF_CONDUCT`, `DISCLAIMER`, issue and PR templates, `dependabot.yml`, `.editorconfig`, `.gitattributes`, `.nvmrc`.

Severity: **Blocker** for release (the brief requires them).
Fix: write them in steps 5–8, short and accurate; several can be built from existing feature docs (`controls.md` → `CONTROLS`, `warnings.md` → part of `HMI_AND_SAFETY`).

## Process files

`CLAUDE.md` (root), `docs/PROGRESS.md`, `docs/SHOWCASE_MOMENTS.md`, `docs/briefs/`, `docs/design/`.
**Proposal:**

- Move the briefs, progress log, showcase notes and the design iterations to `docs/process/`, with a short README describing the spec-driven workflow in your voice.
- Keep `CLAUDE.md` at the root. It reads as a professional engineering rulebook, and the AI tooling expects it there; I'd tidy its wording.

## History strategy (your decision)

- **A, keep history as is:** not possible; R1 and R2 are blockers.
- **B, clean the history (recommended):** on a fresh clone, `git filter-repo` would:
  1. drop the old `docs/screenshots/` and `docs/design/` blobs (the curated images return in one new commit);
  2. rewrite the author and committer email on every commit to your noreply address.

  It keeps all 48 real commits with their Conventional Commit messages, which shows the work. Since nothing is pushed yet, it only replaces the local history; `pre-release-backup` and the zip remain as the safety net. Afterwards, `git count-objects` should show a few MB instead of 235 MiB.

- **C, squash into a few milestone commits:** tidier log, but loses the step-by-step story that shows how the work was done. Not recommended.

## Proposed plan (after your approval)

1. History: Option B on a fresh clone → verify (build, tests, size, emails) → swap it in locally.
2. IP and cleanup: I1–I3, R6–R8, R11–R12, `.gitignore` / `.gitattributes` / `.editorconfig` / `.nvmrc`, Dependabot, process files moved.
3. Stats script → `docs/PROJECT_STATS.md`.
4. README rewrite and the docs pass (all missing docs, index, CHANGELOG, notices).
5. Deployment readiness: 404 page, `<noscript>`, favicon set, canonical URL, OG image, a post-deploy smoke test in CI, Firefox/WebKit in CI, `COMPATIBILITY.md`.
6. `INTERVIEW_PREP.md`, `CV_AND_LINKEDIN.md`.
7. Release `v1.0.0` prepared locally (tag + notes); GitHub setup and push **only with your approval**.
8. Final QA and `LAUNCH_CHECKLIST.md`.
