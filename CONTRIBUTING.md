# Contributing

Kilodash is a personal portfolio project, so I'm not looking for feature contributions. Bug reports,
corrections about how real cars behave, and questions are very welcome: open an issue.

If you'd like to try a change yourself:

## Setup

```bash
nvm use            # Node version from .nvmrc
npm ci
npm run dev        # http://localhost:5173
```

## Before a pull request

Run the same checks as CI:

```bash
npm run lint && npm run typecheck && npm test && npm run docs:check && npm run build && npx playwright test
```

## How the code is organised

- Car behaviour goes in `src/core` as a small, tested state machine. Widgets only draw state.
- High-rate vehicle data never goes through React; the canvas renderer reads the `SignalStore`.
- New behaviour gets a feature doc in `docs/features/`: the real behaviour, how it's simulated, a state
  diagram and its thresholds.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- No manufacturer designs, logos or trademarked feature names.

[ARCHITECTURE](docs/ARCHITECTURE.md) and the [walkthrough](docs/WALKTHROUGH.md) explain the rest.
[CLAUDE.md](CLAUDE.md) holds the full rule set the project was built under.

By contributing you agree that your contribution is licensed under the project's [MIT license](LICENSE)
and that you follow the [code of conduct](CODE_OF_CONDUCT.md).
