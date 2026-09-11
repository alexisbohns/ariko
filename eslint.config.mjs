// Scoped deliberately: react-hooks and @next/next, nothing else.
//
// This is not a style pass. There is no formatter in this repo and this config
// does not pretend to be one — style here is consistent by discipline, and the
// day that stops being true is the day to add Prettier as its own decision.
//
// What it IS for is the class of bug that tsc, node:test and next build all
// pass: a conditional hook (React only throws at runtime, and only on the path
// that hits it) and Next's own footguns. lib/toc-mount.test.ts documented the
// gap for a whole slice before this file existed.
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "docs/**", "data/**"],
  },
  {
    files: ["**/*.{ts,tsx,mjs,js}"],
    // The parser, and ONLY the parser. Stock ESLint reads JavaScript, so
    // without this every .ts and .tsx file here is a parse error rather than a
    // linted file — 258 of them, and not one rule firing. @typescript-eslint's
    // RULES stay deliberately absent: type discipline here is `tsc --noEmit`,
    // and nothing in `rules` below comes from that plugin.
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      // The two rules `eslint-plugin-react-hooks`'s recommended preset sets,
      // spelled out rather than spread, so a major bump that moves the preset's
      // export path cannot silently disable them. v7 of that plugin ships ~29
      // rules; these are the two we asked for.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // After the spreads, so it wins. A plain `<a href>` is this repo's
      // deliberate convention for every link in both zones — CLAUDE.md argues
      // it, and confines `next/link` to the four files of the screen-library
      // slice, where interception needs a client-side navigation and `Link`
      // renders the same anchor anyway. core-web-vitals sets this rule to
      // `error`, so leaving it on points a gate at the documented design: the
      // next correct static href either gets reverted or grows an
      // eslint-disable. It fires on none of the 56 anchors here only because
      // every one of them is dynamic (`href={...}`), which the rule cannot
      // resolve — an accident of style, not a guarantee, and a trap armed to
      // go off on someone else's commit.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];
