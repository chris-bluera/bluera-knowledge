import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Tests for validate-npm-release.sh script.
 * Ensures the script follows best practices for cross-platform compatibility.
 */
describe('validate-npm-release.sh', () => {
  const scriptPath = join(process.cwd(), 'scripts/validate-npm-release.sh');
  const scriptContent = readFileSync(scriptPath, 'utf-8');

  it('does not use hardcoded /tmp paths', () => {
    // Script should use mktemp -d for temporary directories, not hardcoded /tmp
    // This ensures better cross-platform compatibility and avoids path collisions

    // Check for hardcoded /tmp assignments (excluding comments)
    const lines = scriptContent.split('\n').filter((line) => !line.trim().startsWith('#'));
    const hasHardcodedTmp = lines.some((line) => /=["']?\/tmp\//.test(line));

    expect(hasHardcodedTmp).toBe(false);
  });

  it('uses mktemp for temporary directories', () => {
    // Should use mktemp -d for creating temporary directories
    expect(scriptContent).toContain('mktemp -d');
  });

  it('cleans up temporary directories on exit', () => {
    // Should have a trap to clean up on exit
    expect(scriptContent).toContain('trap');
    expect(scriptContent).toMatch(/rm -rf/);
  });

  it('shows real-time output during command execution', () => {
    // Script should use tee to show output on both terminal and log file
    // This prevents the script from appearing "hung" during long-running commands
    expect(scriptContent).toContain('tee -a');
  });

  it('does not redirect output only to log file in run_test functions', () => {
    // The run_test and run_test_contains functions should not silently redirect
    // all output to log file - they should show progress on terminal
    const lines = scriptContent.split('\n');

    // Find run_test function and check it doesn't use silent redirection
    // Pattern: >> "$LOG_FILE" 2>&1 without tee means silent execution
    const hasSilentRedirect = lines.some(
      (line) =>
        line.includes('eval "$cmd"') && line.includes('>> "$LOG_FILE"') && !line.includes('tee')
    );

    expect(hasSilentRedirect).toBe(false);
  });
});
