import js from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
	js.configs.recommended,
	prettierConfig,
	{
		files: ["server/**/*.js"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
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
			"prettier": prettierPlugin
		},
		rules: {
			"prettier/prettier": "error"
			// Ajoute ici des règles spécifiques Node si besoin
		}
	}
];
