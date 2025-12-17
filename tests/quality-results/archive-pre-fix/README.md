# Archived Results (Pre-Fix)

**Archived:** 2025-12-17

These results are from **before** commit `2033677` (2025-12-17 17:44) which fixed the test harness to fail-fast on errors.

## Why These Are Invalid

The original test harness had error-swallowing code that returned `0.00` scores when:
- Claude CLI timed out
- Search queries failed
- AI evaluation failed

This meant failed queries silently returned zero scores instead of aborting the test run, corrupting the aggregate results.

## The Fix

Commit `2033677` removed all try-catch error suppression:
- Errors now propagate and abort the test run
- No more silent `0.00` scores from infrastructure failures
- Binary outcome: test runs either complete successfully or fail completely

## These Files

All results in this directory were generated with the old error-swallowing code and should not be used for baseline comparisons or trend analysis.

The `baseline.json` here was also generated from invalid data.
