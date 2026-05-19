# From The Hart API Reverse Proxy Worker — Domain Glossary

> Canonical terms specific to the API gateway. Extends [master CONTEXT.md](../CONTEXT.md).
> Code conventions: [AGENTS.md](./AGENTS.md).

---

## Client Identity

### ID Token

An OpenID Connect ID Token JWT issued by the **Auth Service** during login or registration, presented by the **Website** with each API request. Validated by the Gateway before forwarding to backend services.

- _Avoid:_ "access token", "bearer token" (too generic)
- _Relationships:_ The **Gateway** validates an **ID Token** before forwarding to any protected route.
  The **ID Token** is forwarded to the **Auth Service** for verification.

---

## Cloud Authentication

### Provider Credentials

The collective term for the Gateway's own authentication credentials used to authenticate *itself* to backend services. Each cloud provider uses a different mechanism.

- _Avoid:_ "cloud tokens", "auth tokens", "service tokens" (too narrow or ambiguous)
- _Relationships:_ **Provider Credentials** are generated per-request for the target backend's cloud provider.

---

## Flagged Ambiguities

- *(None currently — all resolved.)*
