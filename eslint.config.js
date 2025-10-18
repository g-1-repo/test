import antfu from '@antfu/eslint-config'

export default antfu({
  typescript: true,
  ignores: [
    'dist/**',
    'node_modules/**',
    '*.d.ts',
    'coverage/**'
  ],
  rules: {
    // Allow @ts-ignore for framework compatibility
    'ts/ban-ts-comment': 'off',
    // Allow unused vars starting with underscore
    'unused-imports/no-unused-vars': [
      'error',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_'
      }
    ],
    // Allow console statements in test framework
    'no-console': 'off',
    // Allow process usage for Node.js/CLI context
    'node/prefer-global/process': 'off',
    // Allow globals for test framework context
    'no-restricted-globals': 'off',
    // Less strict about switch cases for CLI parsing
    'no-fallthrough': 'warn'
  }
})
