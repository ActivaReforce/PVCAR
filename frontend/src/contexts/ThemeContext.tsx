import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ThemeType = "light" | "dark";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

/**
 * El tema.
 *
 * ---------------------------------------------------------------------------
 * Lo único que hace es poner o quitar la clase `.dark` en <html>
 *
 * Y eso es deliberado. Antes aquí había doce líneas que pisaban seis tokens a
 * mano con `documentElement.style.setProperty`, bajo el comentario "Fix
 * contrast issues in dark mode". Eran **la causa** del problema de contraste,
 * por dos motivos a la vez:
 *
 *   1. Escribían el valor envuelto, `hsl(0 0% 98%)`, en una variable que el
 *      tema vuelve a envolver: `hsl(var(--primary-foreground))` quedaba en
 *      `hsl(hsl(0 0% 98%))`, que no es un color válido. El navegador tira la
 *      declaración y el texto **hereda** el color del padre — blanco en modo
 *      oscuro.
 *   2. Aunque el formato hubiera sido correcto, poner `--primary-foreground`
 *      al 98 % de luminosidad sobre un `--primary` que en oscuro también está
 *      al 98 % es blanco sobre blanco.
 *
 * Lo veía cualquier cosa pintada con `bg-primary` + `text-primary-foreground`:
 * salió a la luz en los coordinadores seleccionados de un colegio, pero era
 * general. Y `--muted-foreground` quedaba igual de roto, así que el texto
 * apagado se veía blanco del todo.
 *
 * Los seis tokens ya están bien definidos en el bloque `.dark` de `index.css`,
 * en el formato que espera Tailwind (terna HSL suelta, sin `hsl()`). No hay
 * nada que arreglar desde JavaScript: si un contraste falla, se corrige el
 * token en el CSS.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme ? savedTheme === "dark" : true;
  });

  useEffect(() => {
    const theme: ThemeType = isDarkMode ? "dark" : "light";
    localStorage.setItem("theme", theme);
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
