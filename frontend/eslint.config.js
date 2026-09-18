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
      // Estaba en "off" heredado del andamiaje original, y con el apagado un
      // import huerfano o una variable muerta no se veian: asi sobrevivieron
      // hasta la Fase 15 cuatro archivos que ya no usaba nadie. Los `_` al
      // principio siguen permitidos para lo que se descarta a proposito.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Eran ~210 usos heredados de la SPA vieja, casi todos en el codigo que
      // hablaba directo con Supabase. Al cerrar la Fase 14 quedaban 10 y en la
      // 15 llegaron a 0, asi que sube a "error": el conteo no vuelve a subir.
      "@typescript-eslint/no-explicit-any": "error",
    },
  }
);
