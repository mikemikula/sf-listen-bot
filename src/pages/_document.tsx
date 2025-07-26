/**
 * Custom Document Component
 * Configures HTML document structure and metadata
 */

import { Html, Head, Main, NextScript } from 'next/document'

/**
 * Custom Document component for HTML structure
 */
export default function Document(): JSX.Element {
  return (
    <Html lang="en">
      <Head>
        {/* Favicon configuration */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        
        {/* Meta tags */}
        <meta name="description" content="Slack Listen Bot - Monitor and display Slack messages" />
        <meta name="theme-color" content="#1f2937" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 