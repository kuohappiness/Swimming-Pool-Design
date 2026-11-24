// Lint baseline (TASK-111) plus the dependency direction from the folder
// migration (TASK-107, DEC-147): model/ -> core/ -> tools/ and web/.
// Website code also runs the type-aware rules (TASK-182).
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Relative imports that climb out of a layer into a folder it must not use.
const forbidLayers = (layers, message, extraPatterns = []) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: [{ regex: `^(\\.\\./)+(${layers.join('|')})/`, message }, ...extraPatterns],
    },
  ],
});

const CORE_LAYER_MESSAGE = 'core/ 是純邏輯，只能依賴 model/，不得引用網站、工具或測試。';
// core/ 不讀檔、不當命令列入口：讀檔與印報告放 tools/（TASK-167）。
const CORE_NO_FILE_ACCESS = {
  regex: '^node:(fs|fs/promises|path|url|child_process|process)$',
  message: 'core/ 不讀檔、不當命令列入口；讀檔與印報告請放 tools/，core/ 只收已讀好的資料。',
};

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'test-results/**',
      'source-materials/**',
      'docs/**',
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
  // 網站程式加上型別規則：抓出多餘的型別斷言、any 外流與忘記處理的 Promise（TASK-182）。
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['web/src/**/*.ts'],
  })),
  {
    files: ['web/src/**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // three.js 的 onBeforeCompile、onBeforeRender 等鉤子要先存下原本的函式，之後用
      // previous.call(this, …) 串接或原樣放回；這條規則會把這種正確寫法全部當成錯。
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['core/**/*.mjs'],
    rules: forbidLayers(['web', 'tools', 'tests'], CORE_LAYER_MESSAGE, [CORE_NO_FILE_ACCESS]),
  },
  {
    files: ['tools/**/*.mjs'],
    rules: forbidLayers(
      ['web', 'tests'],
      'tools/ 只能依賴 core/ 與 model/，不得引用網站程式或測試。',
    ),
  },
  {
    files: ['web/src/**/*.ts'],
    rules: {
      ...forbidLayers(
        ['tools', 'tests', 'source-materials'],
        '網站只能依賴 core/ 與 model/，不得引用工具、測試或原始素材。',
      ),
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='URL'] > Literal[value=/source-materials\\//]",
          message: '網站不得直接讀取 source-materials/，請改用 web/ 內的衍生檔。',
        },
      ],
    },
  },
  {
    files: [
      'core/**/*.mjs',
      'tools/**/*.mjs',
      'tests/**/*.mjs',
      'vite.config.ts',
      'eslint.config.js',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // Browser scripts pass callbacks to page.evaluate, which run in the page.
    files: ['tests/e2e/*.mjs', 'tools/capture/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
