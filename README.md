# Passkey Lookup (AAGUIDs)

**Live site:** [servicelogon.github.io/PasskeyLookup](https://servicelogon.github.io/PasskeyLookup/)

A [New Frontier Security](https://newfrontiersecurity.net/tools) Toolbox tool for looking up Passkey **AAGUIDs** (Authenticator Attestation Globally Unique Identifiers) and matching them to the passkey provider, app, or hardware key that made them — for example Google Password Manager, Apple Passwords, 1Password, or a YubiKey.

## Features

- **Lookup** — paste an AAGUID in any common shape (hyphens, no hyphens, braces, any case) for an instant answer, with clear states for unknown and all-zero AAGUIDs. Lookups are linkable via `?aaguid=`.
- **Directory** — every known provider, grouped by name, filterable by name or any fragment of an AAGUID.
- **Bulk upload** — drop in a CSV or paste a list; the AAGUID column is detected automatically and a Provider column is added to the download.
- Runs entirely in the browser — no backend, nothing uploaded.

## Design

The site uses the shared New Frontier Security system also used by the CAP Evaluator and Entra Token Lab: dark only, Helvetica for UI with Georgia for lede text, hairline rules instead of boxes, text actions instead of buttons, and a single `#f7ff00` accent. The header, tool intro, tab rail, and wireframe footer mark match the other Toolbox tools; tokens live at the top of `src/style.css`.

## Data source

AAGUID mappings come from the community [passkey-authenticator-aaguids](https://github.com/passkeydeveloper/passkey-authenticator-aaguids) registry, plus Yubico's published AAGUID table for YubiKey hardware keys (`src/hardwareKeys.ts`). This data is intended for **UI labeling only**, not security decisions. See [web.dev: Determine the passkey provider with AAGUID](https://web.dev/articles/webauthn-aaguid).

To refresh the bundled dataset:

```bash
npm run update-data
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```


