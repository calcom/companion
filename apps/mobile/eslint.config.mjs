import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    // React Compiler diagnostics only. The last four rules are newer than the old
    // eslint-plugin-react-compiler and flag existing code; re-enable once fixed.
    rules: {
      ...Object.fromEntries(
        Object.entries(reactHooks.configs['recommended-latest'].rules).filter(
          ([name]) => name !== 'react-hooks/rules-of-hooks' && name !== 'react-hooks/exhaustive-deps'
        )
      ),
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'api/**',
      'vendor/**',
      '**/*.generated.*',
      '**/*.d.ts',
      'babel.config.js',
      'metro.config.js',
      'tailwind.config.js',
    ],
  }
);
