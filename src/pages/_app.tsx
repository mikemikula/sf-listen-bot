/**
 * Custom App Component
 * Initializes pages with theme provider and imports global CSS
 */

import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Toaster } from 'react-hot-toast'

/**
 * Custom App component that wraps all pages with theme provider
 */
export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <Component {...pageProps} />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#1f2937',
              border: '1px solid #e5e7eb',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: 'white',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#ef4444',
                secondary: 'white',
              },
            },
          }}
        />
      </ThemeProvider>
    </ErrorBoundary>
  )
} 