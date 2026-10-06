# Security Policy

## Supported version

Emipy is under active development. Security fixes target the current `main` branch and the latest deployed version.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a security vulnerability.

Use GitHub's private vulnerability reporting / security advisory flow when it is available for this repository. If that is not available, contact the maintainer through the contact page at:

https://andreadicoste.site/contact/

Include enough detail to reproduce and understand the issue, but do not send real credentials, private user data or destructive proof-of-concept payloads.

## Security boundaries

A few design assumptions are important when evaluating Emipy:

- student programs are intended to execute in browser Web Workers, not on the application server;
- C/C++, Python, JavaScript and TypeScript runtimes intentionally expose a restricted console-oriented environment;
- authentication and user-owned persistence are server-side;
- curriculum specifications are trusted application data;
- student code, comments, terminal output and chat messages are untrusted data;
- secrets must be supplied through environment variables and must never be committed.

A vulnerability that breaks one of these boundaries is especially important to report.

## Disclosure

Please allow reasonable time for investigation and remediation before public disclosure.
