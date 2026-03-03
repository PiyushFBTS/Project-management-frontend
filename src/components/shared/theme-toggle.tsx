'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`
        relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent transition-colors duration-300 focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-ring
        ${isDark ? 'bg-indigo-600' : 'bg-amber-400'}
      `}
    >
      {/* Track icons */}
      <Sun className="absolute left-1.5 h-3 w-3 text-white/70" />
      <Moon className="absolute right-1.5 h-3 w-3 text-white/70" />
      {/* Thumb */}
      <span
        className={`
          pointer-events-none flex h-5 w-5 items-center justify-center rounded-full
          bg-white shadow-md ring-0 transition-transform duration-300
          ${isDark ? 'translate-x-6.5' : 'translate-x-0.75'}
        `}
      >
        {isDark ? (
          <Moon className="h-3 w-3 text-indigo-600" />
        ) : (
          <Sun className="h-3 w-3 text-amber-500" />
        )}
      </span>
    </button>
  );
}
