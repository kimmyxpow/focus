import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from 'modelence/client';
import { cn } from '@/client/lib/utils';

interface ProfileDropdownProps {
  className?: string;
  isDark?: boolean;
}

export default function ProfileDropdown({ className, isDark = false }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useSession();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    navigate('/logout');
    setIsOpen(false);
  };

  // Get user's initial for avatar - use handle or first character of id
  const initial = user?.handle?.charAt(0).toUpperCase() || user?.id?.charAt(0).toUpperCase() || 'U';

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors",
          isDark ? "hover:bg-white/10" : "hover:bg-stone-100",
          "focus:outline-none focus:ring-2 focus:ring-white/20"
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold",
          isDark ? "bg-white text-stone-900" : "bg-stone-900 text-white"
        )}>
          {initial}
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
            isDark ? "text-white/60" : "text-stone-500"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <title>Toggle dropdown</title>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50",
            "animate-fade-in",
            "bg-stone-900/95 backdrop-blur-md",
            "border border-white/10"
          )}
        >
          {/* Profile */}
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-t-xl",
              "text-sm font-medium text-white/80",
              "hover:bg-white/5",
              "transition-colors"
            )}
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <title>Profile</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Profile</span>
          </Link>

          {/* My Focus */}
          <Link
            to="/focus-overview"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3",
              "text-sm font-medium text-white/80",
              "hover:bg-white/5",
              "transition-colors"
            )}
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <title>My Focus</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
            </svg>
            <span>My Focus</span>
          </Link>

          {/* Divider */}
          <div className="h-px bg-white/10 mx-4" />

          {/* Logout */}
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-b-xl w-full text-left",
              "text-sm font-medium text-white/80",
              "hover:bg-white/5",
              "transition-colors"
            )}
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <title>Sign out</title>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
