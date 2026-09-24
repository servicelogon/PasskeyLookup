# Passkey Lookup (AAGUIDs)

**Live site:** [servicelogon.github.io/PasskeyLookup](https://servicelogon.github.io/PasskeyLookup/)

A minimal web app to look up Passkey **AAGUIDs** (Authenticator Attestation Globally Unique Identifiers) and match them to the passkey provider or app they belong to — for example, Google Password Manager, iCloud Keychain, or 1Password.

## Features

- Paste an AAGUID (with or without hyphens) for instant lookup
- Browse and filter all known providers
- Light and dark mode with theme-aware icons
- Static site — no backend required

## Data source

AAGUID mappings come from the community [passkey-authenticator-aaguids](https://github.com/passkeydeveloper/passkey-authenticator-aaguids) registry. This data is intended for **UI labeling only**, not security decisions. See [web.dev: Determine the passkey provider with AAGUID](https://web.dev/articles/webauthn-aaguid).

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


