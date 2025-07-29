/**
 * Header component with comprehensive navigation for document processing and FAQ features
 */

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { 
  MessageSquare, 
  FileText, 
  HelpCircle, 
  Settings, 
  Shield, 
  Plus, 
  Bot, 
  Bug, 
  Activity,
  X
} from 'lucide-react'

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
        <div className="flex justify-between items-center h-14 sm:h-16">
          {/* Brand */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 hover:opacity-90 transition-opacity min-w-0 flex-1 mr-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-white truncate">SF Listen Bot</h1>
              <p className="text-xs sm:text-sm text-white/80 font-medium truncate">
                <span className="sm:hidden">Doc Processing & FAQ</span>
                <span className="hidden sm:inline">Document Processing & FAQ Generation</span>
              </p>
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
                className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all duration-200 border border-white/20 md:hidden flex-shrink-0"
                aria-label="Open navigation menu"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span className="text-xs sm:text-sm font-medium">Navigation</span>
              </button>

              {/* Desktop Quick Actions Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-all duration-200 border border-white/20"
                aria-label="Open quick actions menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
                <span className="text-sm font-medium">Actions</span>
              </button>

              {isMenuOpen && (
                <>
                  {/* Mobile Full-Screen Navigation Overlay */}
                  <div className="fixed inset-0 z-50 md:hidden">
                    {/* Background Overlay */}
                    <div 
                      className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    
                    {/* Full-Screen Navigation Panel */}
                    <div className="fixed inset-0 bg-white dark:bg-gray-900">
                      {/* Navigation Header */}
                      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 px-4 py-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </div>
                          <div>
                            <h2 className="text-lg font-bold text-white">Navigation</h2>
                            <p className="text-xs text-white/80">SF Listen Bot</p>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => setIsMenuOpen(false)}
                          className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                          aria-label="Close navigation"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Navigation Content */}
                      <div className="flex-1 overflow-y-auto">
                        {/* Main Navigation */}
                        <div className="py-6">
                          <div className="px-6 mb-4">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Main Navigation
                            </h3>
                          </div>
                          
                          <Link
                            href="/"
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center justify-between px-6 py-4 text-base transition-colors ${
                              isActivePage('/') && router.pathname === '/'
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-4 border-blue-500'
                                : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <MessageSquare className={`w-6 h-6 ${
                                isActivePage('/') && router.pathname === '/'
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`} />
                              <div>
                                <div className="font-semibold">Messages</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">View and filter Slack messages</div>
                              </div>
                            </div>
                            {isActivePage('/') && router.pathname === '/' && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            )}
                          </Link>
                          
                          <Link
                            href="/documents"
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center justify-between px-6 py-4 text-base transition-colors ${
                              isActivePage('/documents')
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-4 border-blue-500'
                                : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <FileText className={`w-6 h-6 ${
                                isActivePage('/documents')
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`} />
                              <div>
                                <div className="font-semibold">Documents</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Manage processed documents</div>
                              </div>
                            </div>
                            {isActivePage('/documents') && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            )}
                          </Link>
                          
                          <Link
                            href="/faqs"
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center justify-between px-6 py-4 text-base transition-colors ${
                              isActivePage('/faqs')
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-4 border-blue-500'
                                : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <HelpCircle className={`w-6 h-6 ${
                                isActivePage('/faqs')
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`} />
                              <div>
                                <div className="font-semibold">FAQs</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Browse and manage FAQs</div>
                              </div>
                            </div>
                            {isActivePage('/faqs') && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            )}
                          </Link>
                          
                          <Link
                            href="/processing/dashboard"
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center justify-between px-6 py-4 text-base transition-colors ${
                              isActivePage('/processing')
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-4 border-blue-500'
                                : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <Settings className={`w-6 h-6 ${
                                isActivePage('/processing')
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`} />
                              <div>
                                <div className="font-semibold">Processing</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Monitor system processing</div>
                              </div>
                            </div>
                            {isActivePage('/processing') && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            )}
                          </Link>
                          
                          <Link
                            href="/pii/review"
                            onClick={() => setIsMenuOpen(false)}
                            className={`flex items-center justify-between px-6 py-4 text-base transition-colors ${
                              isActivePage('/pii')
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-4 border-blue-500'
                                : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center space-x-4">
                              <Shield className={`w-6 h-6 ${
                                isActivePage('/pii')
                                  ? 'text-blue-700 dark:text-blue-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`} />
                              <div>
                                <div className="font-semibold">PII Review</div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">Review privacy detections</div>
                              </div>
                            </div>
                            {isActivePage('/pii') && (
                              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                            )}
                          </Link>
                        </div>

                        {/* Connection Status */}
                        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-4">
                            <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-gray-100">
                                {isConnected ? 'Connected to Slack' : 'Slack Disconnected'}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {isConnected ? 'Real-time updates enabled' : 'Check your connection'}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
                          <div className="mb-4">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Quick Actions
                            </h3>
                          </div>
                          
                          <div className="space-y-2">
                            <Link
                              href="/documents?action=create"
                              onClick={() => setIsMenuOpen(false)}
                              className="flex items-center space-x-4 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                            >
                              <Plus className="w-6 h-6 text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">Create Document</span>
                            </Link>
                            
                            <Link
                              href="/faqs?action=generate"
                              onClick={() => setIsMenuOpen(false)}
                              className="flex items-center space-x-4 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                            >
                              <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">Generate FAQs</span>
                            </Link>
                          </div>
                        </div>

                        {/* System Actions */}
                        <div className="px-6 py-6 border-t border-gray-200 dark:border-gray-700">
                          <div className="mb-4">
                            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              System Tools
                            </h3>
                          </div>
                          
                          <div className="space-y-2">
                            <button
                              onClick={() => {
                                onDebugClick()
                                setIsMenuOpen(false)
                              }}
                              className="flex items-center space-x-4 w-full text-left px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                            >
                              <Bug className="w-6 h-6 text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">Debug Events</span>
                            </button>
                            
                            <Link
                              href="/api/health"
                              target="_blank"
                              onClick={() => setIsMenuOpen(false)}
                              className="flex items-center space-x-4 px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                            >
                              <Activity className="w-6 h-6 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">Health Check</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Dropdown - Keep existing for desktop */}
                  <div className="hidden md:block absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 py-3 z-50">
                    {/* Quick Actions - Desktop Only */}
                    <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 mb-3">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        Quick Actions
                      </h3>
                    </div>
                    
                    <Link
                      href="/documents?action=create"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <Plus className="w-5 h-5 text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300 transition-colors" />
                      <span className="font-medium">Create Document</span>
                    </Link>
                    
                    <Link
                      href="/faqs?action=generate"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <Bot className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors" />
                      <span className="font-medium">Generate FAQs</span>
                    </Link>

                    {/* System Actions */}
                    <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 mt-3 mb-3">
                      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        System
                      </h3>
                    </div>
                    
                    <button
                      onClick={() => {
                        onDebugClick()
                        setIsMenuOpen(false)
                      }}
                      className="flex items-center space-x-3 w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <Bug className="w-5 h-5 text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300 transition-colors" />
                      <span className="font-medium">Debug Events</span>
                    </button>
                    
                    <Link
                      href="/api/health"
                      target="_blank"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center space-x-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <Activity className="w-5 h-5 text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors" />
                      <span className="font-medium">Health Check</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header 