import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const getInitialTheme = () => {
  if (typeof window === "undefined") return "light";
  try {
    const storage = localStorage.getItem("theme-storage");
    if (storage) {
      const parsed = JSON.parse(storage);
      if (parsed?.state?.theme === "dark" || parsed?.state?.theme === "light") {
        return parsed.state.theme;
      }
    }
  } catch (e) {}
  return "light";
};

// Immediate sync on load
if (typeof document !== "undefined") {
  const currentTheme = getInitialTheme();
  if (currentTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: getInitialTheme(),
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === "light" ? "dark" : "light";
          if (typeof document !== 'undefined') {
            if (newTheme === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }
          return { theme: newTheme };
        }),
      setTheme: (theme) => {
        if (typeof document !== 'undefined') {
          if (theme === "dark") {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
        set({ theme });
      },
    }),
    {
      name: "theme-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (typeof document !== 'undefined' && state?.theme) {
          if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      },
    }
  )
);
