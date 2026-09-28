import { baseEslintConfig } from '@rxova/repo-config/eslint'

export default baseEslintConfig(
  // No repo tooling lives here, so no console allowance beyond the tests below;
  // the preset's default glob (`packages/repo-config/**`) matches nothing.
  { tsconfigRootDir: import.meta.dirname },
  {
    // The library and its tests import siblings by relative path: the build
    // bundles `src/` as written, with no `@/` alias to resolve.
    files: ['**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-console': 'off',
    },
  },
)
