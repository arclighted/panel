// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Generated/build artifacts and standalone sub-projects are not linted.
    ignores: [
      'dist/**',
      'public/**',
      'node_modules/**',
      'storage/**',
      'smoke/**',
      'coverage/**',
      'scripts/**'
    ]
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  tseslint.configs.stylistic,
  {
    rules: {
      // The codebase uses `!` non-null assertions liberally; leave them to tsc.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Empty functions are used as intentional no-op placeholders (mocks, no-op callbacks).
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      // `const self = this` aliasing is a common idiom in this codebase.
      '@typescript-eslint/no-this-alias': 'off',
      // `delete cache[key]` is the intended way to remove cache entries.
      '@typescript-eslint/no-dynamic-delete': 'off',
      // ESLint 10's no-useless-assignment flags the standard init-then-reassign idiom.
      'no-useless-assignment': 'off',
      // `while (true)` loops are intentional in workers/schedulers.
      'no-constant-condition': ['error', { checkLoops: false }],
      // Allow the `x == null` idiom (checks both null and undefined), require === elsewhere.
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'warn',
      'no-debugger': 'error',
      'curly': ['error', 'all'],
      'semi': ['error', 'always'],
      'quotes': ['warn', 'single'],
      'indent': ['warn', 2],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'warn',
      'no-throw-literal': 'error',
      'no-return-await': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
    },
    languageOptions: {
      globals: {
        node: true,
        jest: true,
        module: true,
        process: true,
        setTimeout: true,
        clearTimeout: true,
        global: true,
        __dirname: true,
        require: true,
        exports: true,
        describe: true,
        it: true,
        expect: true,
        test: true,
        console: true,
        beforeEach: true,
        afterEach: true,
        beforeAll: true,
        afterAll: true
      }
    }
  }
);
