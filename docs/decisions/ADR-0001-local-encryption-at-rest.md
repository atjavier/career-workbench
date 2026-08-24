# ADR-0001: Local encryption-at-rest posture

**Status:** Accepted — 2026-08-07

## Decision

For the personal-device local-only MVP, the application relies on the Windows OS-account boundary and device/full-disk encryption. It does not add application-level encryption for the SQLite database or local files.

## Consequences

- The browser app binds only to `127.0.0.1`; SQLite and the private per-user app-data directory remain authoritative.
- The UI must truthfully describe the OS account as the current access boundary and warn that application-level encryption must be reconsidered before use on a shared or unencrypted device.
- Tokens remain out of the SQLite database and belong in the OS credential vault when later integrations require them.
- Story 1.4 backups remain local to this protected device and rely on the same Windows OS-account and full-disk-encryption boundary. The application does not create portable or application-encrypted backup archives; the UI must warn before any user-directed copy or export could leave this device.

## Revisit

Revisit before the app is used on a shared device, a device without full-disk encryption, or any device with a materially different threat model.
