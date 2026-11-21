// Lint baseline (TASK-111) plus the dependency direction from the folder
// migration (TASK-107, DEC-147): model/ -> core/ -> tools/ and web/.
// Stricter and type-aware rules arrive with the later tooling work.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Relative imports that climb out of a layer into a folder it must not use.
const forbidLayers = (layers, message) => ({
  'no-restricted-imports': ['error', {
    patterns: [{ regex: `^(\\.\\./)+(${layers.join('|')})/`, message }],
  }],
});

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
    files: ['core/**/*.mjs'],
    rules: forbidLayers(['web', 'tools', 'tests'], 'core/ 是純邏輯，只能依賴 model/，不得引用網站、工具或測試。'),
  },
  {
    files: ['tools/**/*.mjs'],
    rules: forbidLayers(['web', 'tests'], 'tools/ 只能依賴 core/ 與 model/，不得引用網站程式或測試。'),
  },
  {
    files: ['web/src/**/*.ts'],
    rules: {
      ...forbidLayers(['tools', 'tests', 'source-materials'], '網站只能依賴 core/ 與 model/，不得引用工具、測試或原始素材。'),
      'no-restricted-syntax': ['error', {
        selector: "NewExpression[callee.name='URL'] > Literal[value=/source-materials\\//]",
        message: '網站不得直接讀取 source-materials/，請改用 web/ 內的衍生檔。',
      }],
    },
  },
  {
    // Temporary exception until TASK-109 moves the satellite base map into a
    // derived file under web/src/views/drawings/assets/.
    files: ['web/src/views/drawings/sheets.ts'],
    rules: { 'no-restricted-syntax': 'off' },
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
