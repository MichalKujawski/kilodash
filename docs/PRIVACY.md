# Privacy

**Short version:** no cookies, no personal data, no third parties. Usage analytics exist as an option, are
off unless the site owner configures them, and even then count only anonymous events.

## What the site stores

Only in your browser (`localStorage`), never sent anywhere:

- that you've seen the intro;
- that you've seen the Drive coach marks;
- in developer mode, your theme choice.

Clearing site data removes all of it.

## What the site loads

Everything comes from the site itself, including the fonts (self-hosted, no font CDN). A browser test
checks that a visit contacts no other host.

## Analytics (off by default)

The build can enable a cookieless, privacy-friendly analytics tool (Plausible or Umami), set in
`.env.local` (`.env.example` shows the variables). No keys are stored in the repository. When enabled:

- **No cookies, no fingerprinting, no IP storage** (that is how both tools work).
- **Never counted:** visitors with Do Not Track or Global Privacy Control switched on, recordings
  (`?record`) and kiosk screens.
- **Only these anonymous events,** with the listed property:

| Event          | Property       | When                                          |
| -------------- | -------------- | --------------------------------------------- |
| Mode           | mode           | Switching Watch / Drive / Engineer            |
| Chapter        | chapter        | A chapter of the guided demo begins           |
| Demo completed | (none)         | The last chapter played to its end            |
| Take the wheel | chapter        | The visitor takes over the car                |
| How it works   | doc            | A feature explanation or decision is opened   |
| Show me        | chapter        | A highlight card's "Show me" is clicked       |
| Highlight seen | chapter        | A highlight loop first comes into view        |
| Outbound       | url (no query) | A link to another site (GitHub, source files) |

Source: `src/app/analytics.ts`.

## Sound

Off until you switch it on.
