---
'ts-extended-errors': major
---

Require Node.js 22.12 or newer. Node 20 reached end of life in April 2026, and a major release is
the one moment the floor can move without surprising anyone. The code uses no Node.js APIs, so
browsers and other runtimes are unaffected; the build now uses the workspace's Node 22 target.
