import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      // Deuda heredada de la SPA original: ~210 usos de `any`, casi todos en el
      // codigo que habla directo con Supabase y que se elimina en las fases 6-14
      // al pasar cada modulo al API. Queda en "warn" para que CI no bloquee por
      // codigo que ya esta condenado; sube a "error" cuando el conteo llegue a 0.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  }
);
