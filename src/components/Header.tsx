/**
 * Header component with comprehensive navigation for document processing and FAQ features
 */

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

interface HeaderProps {
  isConnected: boolean
  onDebugClick: () => void
}

export const Header: React.FC<HeaderProps> = ({ isConnected, onDebugClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isActivePage = (path: string) => {
    return router.pathname === path || router.pathname.startsWith(path + '/')
  }

  return (
    <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 shadow-lg sticky top-0 z-50 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center space-x-3 hover:opacity-90 transition-opacity">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SF Listen Bot</h1>
              <p className="text-sm text-white/80 font-medium">Document Processing & FAQ Generation</p>
            </div>
          </Link>

          {/* Main Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              href="/"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActivePage('/') && router.pathname === '/'
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Messages
            </Link>
            
            <Link
              href="/documents"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActivePage('/documents')
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Documents
            </Link>
            
            <Link
              href="/faqs"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActivePage('/faqs')
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              FAQs
            </Link>
            
            <Link
              href="/processing/dashboard"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActivePage('/processing')
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              Processing
            </Link>
            
            <Link
              href="/pii/review"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActivePage('/pii')
                  ? 'bg-white/20 text-white shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              PII Review
            </Link>
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className="hidden sm:flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="text-sm text-white/80">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Mobile Menu & Actions Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all duration-200 border border-white/20"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="text-sm font-medium">Menu</span>
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                  {/* Mobile Navigation Links */}
                  <div className="block md:hidden border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                    <Link
                      href="/"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      📧 Messages
                    </Link>
                    <Link
                      href="/documents"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      📄 Documents
                    </Link>
                    <Link
                      href="/faqs"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      ❓ FAQs
                    </Link>
                    <Link
                      href="/processing/dashboard"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      ⚙️ Processing
                    </Link>
                  </div>

                  {/* Quick Actions */}
                  <div className="border-b border-gray-200 dark:border-gray-700 pb-2 mb-2">
                    <Link
                      href="/documents?action=create"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      ➕ Create Document
                    </Link>
                    <Link
                      href="/faqs?action=create"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      🤖 Generate FAQs
                    </Link>
                    <Link
                      href="/messages/browse"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      🔍 Browse Messages
                    </Link>
                  </div>

                  {/* System Actions */}
                  <button
                    onClick={() => {
                      onDebugClick()
                      setIsMenuOpen(false)
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    🐛 Debug Events
                  </button>
                  
                  <Link
                    href="/processing/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    📊 System Status
                  </Link>
                  
                  <Link
                    href="/api/health"
                    target="_blank"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    🩺 Health Check
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header 