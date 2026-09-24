# Contributing

Contributions are welcome.

```bash
npm install
npm test
npm run dev
```

Please keep the public API browser-first and avoid putting server secrets in client-side examples.

For robustness changes, add a deterministic transformation case to `tests/robustness.mjs` and document what was actually tested. Do not describe an attack as supported unless it is covered by a reproducible test.
