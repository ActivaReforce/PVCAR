
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

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Try to get theme preference from localStorage or default to true (dark mode)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem("theme");
    return savedTheme ? savedTheme === "dark" : true;
  });

  // Apply theme class to document when theme changes
  useEffect(() => {
    const theme: ThemeType = isDarkMode ? "dark" : "light";
    localStorage.setItem("theme", theme);
    
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      // Fix contrast issues in dark mode
      document.documentElement.style.setProperty('--primary-foreground', 'hsl(0 0% 98%)');
      document.documentElement.style.setProperty('--secondary-foreground', 'hsl(0 0% 98%)');
      document.documentElement.style.setProperty('--destructive-foreground', 'hsl(0 0% 98%)');
      document.documentElement.style.setProperty('--accent-foreground', 'hsl(0 0% 98%)');
      document.documentElement.style.setProperty('--popover-foreground', 'hsl(0 0% 98%)');
      document.documentElement.style.setProperty('--muted-foreground', 'hsl(0 0% 70%)');
    } else {
      document.documentElement.classList.remove("dark");
      // Reset to default light mode values
      document.documentElement.style.removeProperty('--primary-foreground');
      document.documentElement.style.removeProperty('--secondary-foreground');
      document.documentElement.style.removeProperty('--destructive-foreground');
      document.documentElement.style.removeProperty('--accent-foreground');
      document.documentElement.style.removeProperty('--popover-foreground');
      document.documentElement.style.removeProperty('--muted-foreground');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
