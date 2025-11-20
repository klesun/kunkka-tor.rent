import { defineConfig } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import unusedImports from "eslint-plugin-unused-imports";
import _import from "eslint-plugin-import";
import stylistic from "@stylistic/eslint-plugin";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

const plugins = {
    "@typescript-eslint": typescriptEslint,
    "unused-imports": unusedImports,
    import: fixupPluginRules(_import),
    "@stylistic": stylistic,
};

const languageOptions = {
    globals: {
        ...globals.browser,
        ...globals.node,
    },

    parser: tsParser,
    ecmaVersion: 2020,
    sourceType: "module",

    parserOptions: {
        project: "./tsconfig.json",
        parser: "@typescript-eslint/parser",
    },
};

const NO_RESTRICTED_SYNTAX_COMMON = [
    {
        selector: "FunctionDeclaration[generator=true] ReturnStatement[argument!=null]",
        message: "Do not return a value from a generator function, use yield * instead (to prevent very counter-intuitive return of another generator implicitly resulting in an empty generator)",
    },
];

const commonRules = {
    "comma-dangle": ["error", {
        arrays: "always-multiline",
        objects: "always-multiline",
        imports: "ignore",
        exports: "ignore",
        functions: "ignore",
    }],

    "require-await": "warn",
    "prefer-const": "warn",
    "no-var": "warn",

    "no-unused-vars": ["warn", {
        args: "none",
    }],

    "no-mixed-spaces-and-tabs": "error",
    "unused-imports/no-unused-imports": "error",
    "no-trailing-spaces": "error",

    "no-restricted-syntax": ["error", ...NO_RESTRICTED_SYNTAX_COMMON],

    "space-before-blocks": "error",
    "space-in-parens": "error",
    "keyword-spacing": "error",

    "brace-style": ["error", "1tbs", {
        allowSingleLine: true,
    }],

    "space-infix-ops": ["error"],

    quotes: ["error", "double", {
        allowTemplateLiterals: true,
    }],

    "object-curly-spacing": "off",

    "@typescript-eslint/consistent-type-assertions": ["warn", {
        assertionStyle: "never",
    }],

    "@typescript-eslint/consistent-type-imports": ["error", {
        disallowTypeAnnotations: false,
    }],

    "@stylistic/member-delimiter-style": ["warn", {
        multiline: {
            delimiter: "comma",
            requireLast: true,
        },

        singleline: {
            delimiter: "comma",
            requireLast: false,
        },
    }],

    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/semi": ["error"],
    "@typescript-eslint/no-non-null-assertion": "error",

    "no-throw-literal": "off",
    "@typescript-eslint/only-throw-error": "error",
    "@typescript-eslint/switch-exhaustiveness-check": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/no-explicit-any": ["error"],
};

export default defineConfig([{
    "files": [
        "./src/**/*.ts"
    ],
    plugins: plugins,
    languageOptions: languageOptions,
    rules: commonRules,
}, {
    "files": [
        "./views/**/*.ts",
        "./views/**/*.tsx"
    ],
    "settings": {
        "import/resolver": {
            "node": {
                "extensions": [".js", ".jsx", ".ts", ".tsx"]
            }
        }
    },
    plugins: plugins,
    languageOptions: languageOptions,
    "rules": {
        ...commonRules,
        "no-restricted-syntax": ["error", ...NO_RESTRICTED_SYNTAX_COMMON, {
            "selector": "ImportDeclaration[importKind!='type'][source.value='react']",
            "message": "React should be taken from window.React - es6 imports will not work in this project"
        }],
        "import/extensions": ["error", {
            "d": "always",
            "js": "always",
            "jsx": "always",
            "ts": "always",
            "tsx": "always"
        }],
        "@typescript-eslint/no-restricted-imports": ["error", {
            "patterns": [{
                "group": ["@mhc/utils/**"],
                "message": "Please use relative imports for them to work with ts-browser",
                "allowTypeImports": true
            }]
        }]
    }
}]);