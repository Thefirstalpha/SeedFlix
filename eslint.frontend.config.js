import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import unusedImports from "eslint-plugin-unused-imports";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	prettierConfig,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaFeatures: { jsx: true },
				ecmaVersion: "latest",
				sourceType: "module"
			},
			// env supprimé : non supporté en flat config
			globals: {
				React: "readonly",
				HTMLDivElement: "readonly",
				HTMLImageElement: "readonly",
				URLSearchParams: "readonly",
				Node: "readonly",
				Notification: "readonly",
				Window: "readonly",
				WheelEvent: "readonly",
				window: "readonly",
				document: "readonly",
				console: "readonly",
				setTimeout: "readonly",
				setInterval: "readonly",
				clearTimeout: "readonly",
				clearInterval: "readonly",
				fetch: "readonly",
				navigator: "readonly",
				CustomEvent: "readonly",
				Event: "readonly",
				MouseEvent: "readonly",
				KeyboardEvent: "readonly",
				localStorage: "readonly",
				Response: "readonly"
			}
		},
		plugins: {
			"@typescript-eslint": tseslint,
			"react": reactPlugin,
			"unused-imports": unusedImports,
			"import": importPlugin,
			"prettier": prettierPlugin
		},
		rules: {
			"no-unused-vars": "off",
			"unused-imports/no-unused-imports": "error",
			"@typescript-eslint/no-unused-vars": ["error", { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }],
			// ... (autres règles personnalisées ici)
		}
	}
];
