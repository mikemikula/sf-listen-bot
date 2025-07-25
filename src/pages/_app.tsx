/**
 * Custom App Component
 * Initializes pages and imports global CSS
 */

import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '@/components/ErrorBoundary'

/**
 * Custom App component that wraps all pages
 */
export default function App({ Component, pageProps }: AppProps): JSX.Element {
  return (
    <ErrorBoundary>
      <Component {...pageProps} />
    </ErrorBoundary>
  )
} 