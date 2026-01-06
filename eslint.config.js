import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintComments from 'eslint-plugin-eslint-comments';
import requireSkipComment from './eslint-rules/require-skip-comment.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      'eslint-comments': eslintComments,
    },
    rules: {
      // Type safety
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],

      // Dead code detection
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-unreachable': 'error',
      'no-unreachable-loop': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],

      // Require explanations for ESLint disable comments (warn for now to allow gradual fix)
      'eslint-comments/require-description': 'warn',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', '*.config.ts', '**/*.test.ts', 'tests/**/*.ts'],
  },
  // Test files: Apply custom skip-comment rule only
  {
    files: ['**/*.test.ts', 'tests/**/*.ts'],
    plugins: {
      'custom': {
        rules: {
          'require-skip-comment': requireSkipComment,
        },
      },
    },
    rules: {
      'custom/require-skip-comment': 'error',
    },
  }
);
