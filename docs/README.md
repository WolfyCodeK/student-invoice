# Student Invoice — documentation

Student Invoice is a Windows desktop app for a music teacher. It turns one
template per student or family into a half-term invoice email, which can be
copied to the clipboard or saved as a Gmail draft. These docs are the
reference for developers and AI assistants. Their accuracy is enforced by
tooling (see [documentation](documentation.md)).

## Reading order

1. [Architecture](architecture.md): how the pieces fit, and every command the
   UI can call.
2. [Data model](data-model.md): what is stored, where, and the rules for
   changing it.
3. [Compatibility](compatibility.md): what must never change, so updates stay
   safe for every installed version.
4. [Billing](billing.md): the exact money rules. Changes need the owner's
   approval.
5. [Development](development.md): setup, scripts, tests, hooks and CI.

## Reference

- [UI](ui.md): screens, dialogs, theme.
- [Gmail](gmail.md): OAuth sign-in and draft creation.
- [Security](security.md): secrets handling and the webview boundary.
- [Release](release.md): how a version is built, signed and published.
- [Documentation](documentation.md): how these docs are kept true.

## Records (dated; not kept in sync with code)

- [Bug audit, Sept 2026](audits/2026-09-bug-audit.md)
- [Security audit, Sept 2026](audits/2026-09-security-audit.md)
- [Proposals](proposals/README.md): changes awaiting or given owner approval.
- Changelog: `CHANGELOG.md` at the repo root.
