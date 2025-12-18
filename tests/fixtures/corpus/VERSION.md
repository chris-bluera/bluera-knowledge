# Test Corpus Version

## Current Version: 3.0.0

## Contents
- **oss-repos/vue**: Vue.js core repository (~593 files) - complete source
- **oss-repos/express**: Express.js repository (~206 files) - complete source
- **oss-repos/hono**: Hono v4.6.0 (~191 files) - complete source
- **documentation/**: Express.js and Node.js excerpts
- **articles/**: Technical articles (React hooks, TypeScript, JWT)

## Last Updated
2025-12-18

## Change Log
- v3.0.0: Replaced sample files with full Vue.js and Express.js repositories
- v2.0.0: Replaced Zod with Vue.js and Express.js for broader framework coverage
- v1.0.0: Initial corpus with Zod, Hono, docs, and articles

## Maintenance
When updating corpus:
1. Update version number above
2. Update contents list
3. Run `npm run test:corpus:index` to rebuild index
4. Run `npm run test:quality -- --update-baseline` to set new baseline
