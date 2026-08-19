import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
export default [
	js.configs.recommended,
	prettierConfig,
	{
		files: ["server/**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module"
			},
			globals: {
				process: "readonly",
				console: "readonly",
				Buffer: "readonly",
				URL: "readonly",
				fetch: "readonly",
				setTimeout: "readonly",
				clearTimeout: "readonly",
				setInterval: "readonly",
				clearInterval: "readonly",
				AbortController: "readonly",
				structuredClone: "readonly"
			}
		},
		plugins: {
			"@typescript-eslint": tseslint,
			"prettier": prettierPlugin
		},
		rules: {
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": ["error", { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }],
			"prettier/prettier": ["error", { "endOfLine": "auto" }]
			// Ajoute ici des règles spécifiques Node si besoin
		}
	}
];
