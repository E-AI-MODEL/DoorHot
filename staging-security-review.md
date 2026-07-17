# Door010 staging security/privacy review

- Target: http://localhost:42285
- Generated: 2026-07-16T05:18:08.213Z
- Result: PASS

## Findings

No findings.

## Checks

- PASS — http.status: HTTP 200
- PASS — header.x-content-type-options: nosniff
- PASS — header.x-frame-options: DENY
- PASS — header.referrer-policy: strict-origin-when-cross-origin
- PASS — header.content-security-policy: default-src 'self'; frame-ancestors 'none'
- PASS — header.permissions-policy: camera=(), microphone=(), geolocation=()
- PASS — body.secret-pattern-1: No match.
- PASS — body.secret-pattern-2: No match.
- PASS — body.secret-pattern-3: No match.
- PASS — body.secret-pattern-4: No match.
- PASS — privacy.noindex-staging: Checked meta robots and X-Robots-Tag.
- PASS — transport.hsts: max-age=31536000; includeSubDomains