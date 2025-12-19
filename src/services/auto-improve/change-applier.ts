import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { Change } from './types.js';

export interface ApplyResult {
  success: boolean;
  appliedCount: number;
  errors: string[];
  order: string[];
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
}

/**
 * Safely applies code and config changes to files.
 * Supports validation, application, and reversion of changes.
 */
export class ChangeApplier {
  constructor(_projectRoot: string) {
    // projectRoot reserved for future use (TypeScript compilation checks, etc.)
  }

  /**
   * Applies changes in priority order (lower priority number = applied first).
   * Stops on first error and reports partial success.
   */
  async apply(changes: Change[]): Promise<ApplyResult> {
    const sortedChanges = [...changes].sort((a, b) => a.priority - b.priority);
    const result: ApplyResult = {
      success: true,
      appliedCount: 0,
      errors: [],
      order: [],
    };

    for (const change of sortedChanges) {
      const applyResult = this.applyChange(change);
      if (applyResult.success) {
        result.appliedCount++;
        result.order.push(change.file);
      } else {
        result.success = false;
        result.errors.push(applyResult.error);
        break;
      }
    }

    return result;
  }

  /**
   * Validates changes without applying them.
   * Checks that all files exist and before content matches.
   */
  async validate(changes: Change[]): Promise<ValidateResult> {
    const result: ValidateResult = {
      valid: true,
      errors: [],
    };

    for (const change of changes) {
      const validation = this.validateChange(change);
      if (!validation.valid) {
        result.valid = false;
        result.errors.push(validation.error);
      }
    }

    return result;
  }

  /**
   * Reverts changes by restoring the before content.
   * Reverts in reverse priority order.
   */
  async revert(changes: Change[]): Promise<void> {
    const sortedChanges = [...changes].sort((a, b) => b.priority - a.priority);

    for (const change of sortedChanges) {
      if (existsSync(change.file)) {
        const currentContent = readFileSync(change.file, 'utf-8');
        // Only revert if the file contains the 'after' content
        if (currentContent.includes(change.after) || change.type === 'config') {
          if (change.type === 'config') {
            // For config files, replace the entire content
            writeFileSync(change.file, change.before, 'utf-8');
          } else {
            // For code files, replace the specific pattern
            const newContent = currentContent.replace(change.after, change.before);
            writeFileSync(change.file, newContent, 'utf-8');
          }
        }
      }
    }
  }

  private applyChange(change: Change): { success: boolean; error: string } {
    if (!existsSync(change.file)) {
      return { success: false, error: `File not found: ${change.file}` };
    }

    const content = readFileSync(change.file, 'utf-8');

    if (change.type === 'config') {
      // For config files, we expect exact content match
      if (content !== change.before) {
        return {
          success: false,
          error: `Content does not match expected for ${change.file}`,
        };
      }
      writeFileSync(change.file, change.after, 'utf-8');
    } else {
      // For code files, we do a substring replacement
      if (!content.includes(change.before)) {
        return {
          success: false,
          error: `Expected content not found in ${change.file}`,
        };
      }
      const newContent = content.replace(change.before, change.after);
      writeFileSync(change.file, newContent, 'utf-8');
    }

    return { success: true, error: '' };
  }

  private validateChange(change: Change): { valid: boolean; error: string } {
    if (!existsSync(change.file)) {
      return { valid: false, error: `File not found: ${change.file}` };
    }

    const content = readFileSync(change.file, 'utf-8');

    if (change.type === 'config') {
      if (content !== change.before) {
        return {
          valid: false,
          error: `Content does not match expected for ${change.file}`,
        };
      }
    } else {
      if (!content.includes(change.before)) {
        return {
          valid: false,
          error: `Expected content not found in ${change.file}`,
        };
      }
    }

    return { valid: true, error: '' };
  }
}
