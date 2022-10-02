// src/pages/_app.tsx
import { httpBatchLink } from '@trpc/client/links/httpBatchLink'
import { loggerLink } from '@trpc/client/links/loggerLink'
import { withTRPC } from '@trpc/next'
import type { AppType, NextPageContext } from 'next/dist/shared/lib/utils'
import superjson from 'superjson'
import type { AppRouter } from '../server/router'
import '../styles/globals.css'
import { createWSClient, wsLink } from '@trpc/client/links/wsLink'
import dynamic from 'next/dynamic'

const MyApp: AppType = ({ Component, pageProps }) => {
  return <Component {...pageProps} />
}

const getBaseUrl = () => {
  if (typeof window !== 'undefined') return '' // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}` // SSR should use vercel url
  return `https://cel-web:${process.env.PORT ?? 3000}` // dev SSR should use localhost
}

function getEndingLinks(ctx: NextPageContext | undefined) {
  const links = [httpBatchLink({ url: `${getBaseUrl()}/api/trpc` })]
  if (typeof window !== 'undefined') {
    console.log('🌷 not doing SSR')
    const client = createWSClient({
      url: `ws://localhost:3030`,
    })
    links.push(wsLink<AppRouter>({ client }))
  }
  return links
}

export default withTRPC<AppRouter>({
  config({ ctx }) {
    /**
     * If you want to use SSR, you need to use the server's full URL
     * @link https://trpc.io/docs/ssr
     */
    const url = `${getBaseUrl()}/api/trpc`

    return {
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        ...getEndingLinks(ctx),
      ],
      url,
      transformer: superjson,
      /**
       * @link https://react-query.tanstack.com/reference/QueryClient
       */
      // queryClientConfig: { defaultOptions: { queries: { staleTime: 60 } } },

      // To use SSR properly you need to forward the client's headers to the server
      // headers: () => {
      //   if (ctx?.req) {
      //     const headers = ctx?.req?.headers;
      //     delete headers?.connection;
      //     return {
      //       ...headers,
      //       "x-ssr": "1",
      //     };
      //   }
      //   return {};
      // }
    }
  },
  /**
   * @link https://trpc.io/docs/ssr
   */
  ssr: false,
})(MyApp)
