# Bean and pod slugs — the reference for `::entity{ref=…}`

Writing agents: use these EXACTLY. Never invent or guess a slug. If the thing you
want to link is not on this list, it has no bean — describe it in a clause instead
of linking it, or leave `[TO VERIFY: is there a bean for X?]`.

Source of truth: `docs/superpowers/specs/2026-09-02-pbbls-case-study-design.md` §5.2–5.3.
Keep in sync when the spec's bean map changes.

## Plant

`plant:pbbls`

## Pods

| Ref | Name |
|---|---|
| `pod:pbbls-web` | The Web App |
| `pod:pbbls-ios` | The iOS App |
| `pod:pbbls-android` | The Android App |
| `pod:pbbls-backstage` | Backstage |
| `pod:pbbls-record` | Recording a Pebble |
| `pod:pbbls-pebble` | Pebbles & Glyphs |
| `pod:pbbls-path` | The Path |
| `pod:pbbls-karma` | Karma & the Glyph Market |
| `pod:pbbls-souls` | Souls & Domains |
| `pod:pbbls-public` | Connecting & Sharing |
| `pod:pbbls-atelier` | The Workshop |

## Beans

Surfaces — `bean:pbbls-web-shell` · `bean:pbbls-polaroid-wall` ·
`bean:pbbls-ios-jump` · `bean:pbbls-ios-two-composers` ·
`bean:pbbls-ios-live-activity` · `bean:pbbls-android-six-days` ·
`bean:pbbls-android-parity-audit` · `bean:pbbls-android-divergence` ·
`bean:pbbls-analytics` · `bean:pbbls-moderation` · `bean:pbbls-lab`

Domains — `bean:pbbls-record-flow` · `bean:pbbls-cards` · `bean:pbbls-drafts` ·
`bean:pbbls-valence` · `bean:pbbls-wobble` · `bean:pbbls-glyph-carving` ·
`bean:pbbls-render` · `bean:pbbls-colour` · `bean:pbbls-path-nav` ·
`bean:pbbls-collections` · `bean:pbbls-wallet` · `bean:pbbls-market` ·
`bean:pbbls-d8` · `bean:pbbls-reward-not-prison` · `bean:pbbls-badges` ·
`bean:pbbls-souls-not-users` · `bean:pbbls-domains-greek` ·
`bean:pbbls-emotions` · `bean:pbbls-connections` ·
`bean:pbbls-profiles-handles` · `bean:pbbls-sharing` ·
`bean:pbbls-privacy-grades` · `bean:pbbls-deletion-consent`

Atelier — `bean:pbbls-naming` · `bean:pbbls-pivot` · `bean:pbbls-psychology` ·
`bean:pbbls-agentic` · `bean:pbbls-arkaik` · `bean:pbbls-harnesses` ·
`bean:pbbls-cut` · `bean:pbbls-unbuilt`

## Notes

- `bean:pbbls-agentic` is specified but its first draft was **rejected and binned**.
  Link to it only if the subject genuinely belongs there.
- Legacy seeded beans `bean:pbbls-webapp` and `bean:pbbls-ios` still exist in the
  garden and are scheduled to retire (spec §9.2). **Never link to either** — and
  note `bean:pbbls-ios` is NOT the iOS pod, which is `pod:pbbls-ios`.
