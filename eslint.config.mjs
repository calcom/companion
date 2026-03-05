import reactCompiler from 'eslint-plugin-react-compiler';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'react-compiler': reactCompiler,
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
    rules: {
      'react-compiler/react-compiler': 'error',
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      '.wxt/**',
      '.output/**',
      'android/**',
      'ios/**',
      'apps/extension/**',
      '**/*.generated.*',
      '**/*.d.ts',
      'apps/mobile/babel.config.js',
      'apps/mobile/metro.config.js',
      'apps/mobile/tailwind.config.js',
      'apps/extension/wxt.config.ts',
    ],
  }
);

