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

  // Get user's nickname for avatar
  const nickname = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
          "hover:bg-white/10",
          "focus:outline-none focus:ring-2 focus:ring-white/20"
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-semibold",
          isDark ? "bg-white text-stone-900" : "bg-stone-900 text-white"
        )}>
          {nickname}
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
            isDark ? "text-white/60" : "text-stone-500"
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
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
          {/* My Focus */}
          <Link
            to="/focus-overview"
            onClick={() => setIsOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-t-xl",
              "text-sm font-medium text-white/80",
              "hover:bg-white/5",
              "transition-colors"
            )}
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 016 16.5h20.25M2.25 3h11.25M3.75 12h16.5M16.5 20.25h-2.25m0-11.177v-11.18M12 20.25l-2.25-2.25M14.25 12.75l-2.25-2.25" />
            </svg>
            <span>My Focus</span>
          </Link>

          {/* Divider */}
          <div className="h-px bg-white/10 mx-4" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-b-xl w-full text-left",
              "text-sm font-medium text-white/80",
              "hover:bg-white/5",
              "transition-colors"
            )}
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
