/**
 * Page wrapper with floating navbar
 * - Manrope font
 * - Centered content with proper padding
 * - Subtle active nav indicators (not button-like)
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from 'modelence/client';
import LoadingSpinner from '@/client/components/LoadingSpinner';
import FloatingSessionWidget from '@/client/components/FloatingSessionWidget';
import ProfileDropdown from '@/client/components/ProfileDropdown';
import { cn } from '@/client/lib/utils';

interface PageProps {
  children?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
  variant?: 'default' | 'dark';
  hideNav?: boolean;
  centered?: boolean;
}

function FloatingNavbar({ variant = 'default' }: { variant?: 'default' | 'dark' }) {
  const { user } = useSession();
  const location = useLocation();
  const isDark = variant === 'dark';

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className={cn("navbar-float", isDark && "navbar-float-dark")}>
      <div className="flex items-center gap-1">
        {/* Logo */}
        <Link
          to="/"
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors",
            isDark ? "hover:bg-white/10" : "hover:bg-stone-100"
          )}
        >
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm",
            isDark ? "bg-white text-stone-900" : "bg-stone-900 text-white"
          )}>
            F
          </div>
          <span className={cn(
            "font-semibold text-sm hidden sm:block",
            isDark ? "text-white" : "text-stone-900"
          )}>
            Focus
          </span>
        </Link>

        {/* Divider */}
        <div className={cn("w-px h-5 mx-2", isDark ? "bg-white/10" : "bg-stone-200")} />

        {/* Navigation - subtle active indicator */}
        <div className="flex items-center gap-0.5">
          <Link
            to="/"
            className={cn(
              "nav-link",
              isDark && "nav-link-dark",
              isActive('/') && "nav-link-active"
            )}
          >
            Sessions
          </Link>
          <Link
            to="/leaderboard"
            className={cn(
              "nav-link",
              isDark && "nav-link-dark",
              isActive('/leaderboard') && "nav-link-active"
            )}
          >
            Leaderboard
          </Link>
          {user && (
            <Link
              to="/focus-overview"
              className={cn(
                "nav-link",
                isDark && "nav-link-dark",
                isActive('/focus-overview') && "nav-link-active"
              )}
            >
              My Focus
            </Link>
          )}
        </div>

        {/* Divider */}
        <div className={cn("w-px h-5 mx-2", isDark ? "bg-white/10" : "bg-stone-200")} />

        {/* User Actions */}
        {user ? (
          <div className="flex items-center gap-1">
            <Link
              to="/create-session"
              className={cn("nav-btn-primary", isDark && "nav-btn-primary-dark")}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Session</span>
              <span className="sm:hidden">New</span>
            </Link>
            <ProfileDropdown isDark={isDark} />
          </div>
        ) : (
          <Link to="/login" className={cn("nav-btn-primary", isDark && "nav-btn-primary-dark")}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function Page({
  children,
  className,
  isLoading = false,
  variant = 'default',
  hideNav = false,
  centered = false
}: PageProps) {
  const isDark = variant === 'dark';

  return (
    <div className={cn("page-wrapper", isDark && "page-wrapper-dark")}>
      {!hideNav && <FloatingNavbar variant={variant} />}
      <FloatingSessionWidget />
      <main className={cn(
        centered ? "page-content-centered" : "page-content",
        hideNav && "!pt-0",
        className
      )}>
        {isLoading ? (
          <div className="flex items-center justify-center w-full min-h-[60vh]">
            <LoadingSpinner />
          </div>
        ) : children}
      </main>
    </div>
  );
}
