/**
 * Custom App Component
 * Initializes pages with theme provider and imports global CSS
 */

import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ThemeProvider } from '@/contexts/ThemeContext'

/**
 * Custom App component that wraps all pages with theme provider
 */
export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system">
        <Component {...pageProps} />
      </ThemeProvider>
    </ErrorBoundary>
  )
} 