import pluginJs from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';
import pluginImportX from 'eslint-plugin-import-x';
import pluginNoOnlyTests from 'eslint-plugin-no-only-tests';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        ignores: ['dist/**', 'dev-dist/**', 'coverage/**'],
    },
    { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
    { languageOptions: { globals: globals.browser } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/await-thenable': 'error',
        },
    },
    pluginReact.configs.flat.recommended,
    pluginReactHooks.configs.flat.recommended,
    // Disables every ESLint rule that overlaps with what Prettier already
    // formats (indentation, quotes, commas, spacing, JSX layout, etc.), so
    // the custom rules below never need to duplicate/fight Prettier's job.
    prettierConfig,
    {
        // Only rules that actually take effect are listed here - anything
        // that's purely a formatting concern already handled by Prettier is
        // omitted rather than kept as dead configuration, since re-enabling
        // it here would just reintroduce a conflict with `prettierConfig`
        // above.
        plugins: {
            '@stylistic': stylistic,
            'import-x': pluginImportX,
            'no-only-tests': pluginNoOnlyTests,
        },
        rules: {
            'one-var': ['error', 'never'],
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                },
            ],
            'spaced-comment': [
                'error',
                'always',
                {
                    line: {
                        markers: ['/'],
                        exceptions: ['-', '+'],
                    },
                    block: {
                        markers: ['!'],
                        exceptions: ['*'],
                        balanced: true,
                    },
                },
            ],
            'import-x/no-unresolved': 'off',
            'import-x/named': 'off',
            'import-x/no-named-as-default': 'off',
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'parent', 'sibling', 'index'],
                    'newlines-between': 'always',
                },
            ],
            'consistent-return': 'error',
            'import-x/no-empty-named-blocks': 'error',
            'import-x/newline-after-import': [
                'error',
                {
                    count: 1,
                },
            ],
            'no-only-tests/no-only-tests': 'error',
            'no-console': ['error'],
            'no-alert': 'error',
            'require-await': 'error',
            'class-methods-use-this': 'error',
            'react/jsx-boolean-value': ['error', 'always'],
            'no-shadow': ['error', { allow: ['this'] }],
            'object-shorthand': ['error', 'always'],
            'no-useless-rename': [
                'error',
                {
                    ignoreDestructuring: false,
                    ignoreImport: false,
                    ignoreExport: false,
                },
            ],
            'react/react-in-jsx-scope': 'off',
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    args: 'all',
                    argsIgnorePattern: '^_',
                    caughtErrors: 'all',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    ignoreRestSiblings: true,
                },
            ],
            '@typescript-eslint/no-empty-object-type': 'off',
            'no-unreachable': ['warn'],
            '@typescript-eslint/member-ordering': 'error',
            'prefer-template': 'error',
            'react/jsx-curly-brace-presence': [
                'error',
                {
                    props: 'always',
                    children: 'always',
                },
            ],
            'arrow-body-style': ['error', 'as-needed', { requireReturnForObjectLiteral: true }],

            'prefer-destructuring': [
                'error',
                {
                    VariableDeclarator: {
                        object: true,
                    },
                    AssignmentExpression: {},
                },
                { enforceForRenamedProperties: false },
            ],
            'no-new': 'error',
            'no-throw-literal': 'error',
            'prefer-promise-reject-errors': 'error',
            'max-params': ['error', 4],
            'no-useless-return': 'error',
            'no-void': ['error', { allowAsStatement: true }],

            'valid-typeof': 'error',
            'no-unneeded-ternary': 'error',
            'no-nested-ternary': 'error',
            eqeqeq: ['error', 'smart'],
            'no-return-assign': ['error', 'always'],
            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowTernary: true,
                    allowShortCircuit: true,
                },
            ],
            'no-shadow-restricted-names': 'error',
            'no-restricted-globals': 'error',
            'prefer-arrow-callback': 'error',
            'no-duplicate-imports': 'error',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/ban-ts-comment': [
                'error',
                { 'ts-ignore': 'allow-with-description' },
            ],
            'react/self-closing-comp': [
                'error',
                {
                    component: true,
                    html: true,
                },
            ],
            '@stylistic/padding-line-between-statements': [
                'error',
                {
                    blankLine: 'always',
                    prev: 'block-like',
                    next: '*',
                },
                {
                    blankLine: 'always',
                    prev: ['const', 'let', 'var'],
                    next: '*',
                },
                {
                    blankLine: 'any',
                    prev: ['const', 'let', 'var'],
                    next: ['const', 'let', 'var'],
                },
                {
                    blankLine: 'always',
                    prev: '*',
                    next: 'return',
                },
                {
                    blankLine: 'always',
                    prev: ['enum', 'interface', 'type'],
                    next: '*',
                },
            ],
            // TS handles it
            'no-undef': 'off',
            'no-empty': ['error', { allowEmptyCatch: true }],
        },
    },
];
