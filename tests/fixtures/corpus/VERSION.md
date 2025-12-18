# Test Corpus Version

## Current Version: 2.0.0

## Contents
- **oss-repos/vue**: Vue.js v3.5.x (progressive JavaScript framework)
- **oss-repos/express**: Express.js v5.x (Node.js web framework)
- **oss-repos/hono**: Hono v4.6.0 (lightweight web framework)
- **documentation/**: Express.js and Node.js excerpts
- **articles/**: Technical articles (React hooks, TypeScript, JWT)

## Last Updated
2025-12-17

## Change Log
- v2.0.0: Replaced Zod with Vue.js and Express.js for broader framework coverage
- v1.0.0: Initial corpus with Zod, Hono, docs, and articles

## Maintenance
When updating corpus:
1. Update version number above
2. Update contents list
3. Run `npm run test:corpus:index` to rebuild index
4. Run `npm run test:quality -- --update-baseline` to set new baseline
