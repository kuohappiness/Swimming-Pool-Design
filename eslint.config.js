// Minimal lint baseline (TASK-111). Stricter and type-aware rules, and the
// dependency-direction rules for web/, core/ and tools/, arrive with the folder
// migration (TASK-107) and the later tooling work.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'test-results/**',
      'deliverables/**',
      'versions/**',
      'source-materials/**',
      'docs/**',
      'reference/drafts/**',
      'web/src/generated/**',
      'drawings/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore marks a parameter kept for an interface shape.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Full-width spaces inside page copy are intentional typography.
      'no-irregular-whitespace': ['error', { skipStrings: true, skipTemplates: true }],
    },
  },
  {
    files: ['web/src/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['core/**/*.mjs', 'tools/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Browser scripts pass callbacks to page.evaluate, which run in the page.
    files: ['tests/e2e/*.mjs', 'tools/capture/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
