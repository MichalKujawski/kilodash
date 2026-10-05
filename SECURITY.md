# Security

Kilodash is a static website with no server, no accounts and no personal data. Settings stay in the
visitor's browser ([privacy](docs/PRIVACY.md)).

## Reporting a problem

If you find a security problem (for example a way to run script through a URL parameter or an imported
theme file), please report it privately through GitHub's
[private vulnerability reporting](https://github.com/MichalKujawski/kilodash/security/advisories/new)
rather than in a public issue.

## Supported versions

Only the latest release on `main` gets fixes.

## What's in place

- No secrets in the repository; analytics keys, if used, come from `.env.local` (git-ignored).
- Dependabot keeps npm packages and GitHub Actions up to date.
- Imported theme files are validated field by field and never executed
  (`src/cluster/themes/validate.ts`).
- A browser test checks that the site contacts no other host.
