import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("cognify-theme");
    // Default to dark mode
    const isDark = stored ? stored === "dark" : true;
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("cognify-theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <button onClick={toggle} className="p-2 rounded-lg hover:bg-secondary transition-colors" aria-label="Toggle theme">
      {dark ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
    </button>
  );
}