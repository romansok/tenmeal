/**
 * Lightweight fluent stub for the @supabase/ssr server client used in actions.ts.
 *
 * Real client chains: supabase.from('t').select('cols').eq(c, v).is(c, v).single()
 * The stub accepts a `responses` map keyed by `<table>:<op>` and returns the
 * configured result from `.single() / .maybeSingle() / await chain` regardless
 * of how many filter calls came before. Every chain method returns the same
 * builder so long pipelines work.
 */

import { vi } from 'vitest'

type Op = 'select' | 'insert' | 'update' | 'delete' | 'count'

export interface QueryResult<T = unknown> {
  data: T | null
  error: { message: string; code?: string } | null
  count?: number
}

type Responder<T = unknown> =
  | QueryResult<T>
  | ((calls: ChainCall[]) => QueryResult<T>)

interface ChainCall {
  method: string
  args: unknown[]
}

export interface SupabaseMockOptions {
  /** Maps `<table>:<op>` to a fixed result or a function over the chain calls. */
  responses?: Record<string, Responder>
  /** What `auth.getUser()` returns. Default: a logged-in fake user. */
  authUser?: { id: string } | null
  /** What `auth.signOut()` resolves to (default: success). */
  signOutError?: { message: string } | null
}

const DEFAULT_USER = { id: 'auth-user-1' }

export function createSupabaseMock(opts: SupabaseMockOptions = {}) {
  const responses = opts.responses ?? {}
  const fromCalls: { table: string; op: Op | null; chain: ChainCall[] }[] = []

  function makeBuilder(table: string) {
    const calls: ChainCall[] = []
    let op: Op | null = null

    const tracked = (method: string, ...args: unknown[]) => {
      calls.push({ method, args })
      // Detect the operation from the first builder method.
      if (op === null) {
        if (method === 'select' || method === 'insert' || method === 'update' || method === 'delete') {
          op = method as Op
        }
      }
      // count: signaled via .select('cols', { count: 'exact', head: true })
      if (method === 'select' && args.length >= 2) {
        const opts = args[1] as { count?: string }
        if (opts?.count) op = 'count'
      }
      return builder
    }

    function resolve(): QueryResult {
      const finalOp = op ?? 'select'
      fromCalls.push({ table, op: finalOp, chain: [...calls] })
      const key = `${table}:${finalOp}`
      const r = responses[key]
      if (typeof r === 'function') return r(calls)
      return r ?? { data: null, error: null }
    }

    /**
     * Wraps a (possibly-resolved) result in a thenable that ALSO supports
     * chained `.returns<T>()` — Supabase's runtime no-op type assertion.
     * Real client allows: `.single().returns<T>()` AND `.returns<T>().single()`.
     */
    function makeThenable(getResult: () => QueryResult): any {
      const t: any = {
        then: (onFulfilled?: any, onRejected?: any) =>
          Promise.resolve(getResult()).then(onFulfilled, onRejected),
        returns: () => t,
        single: () => makeThenable(getResult),
        maybeSingle: () => makeThenable(getResult),
      }
      return t
    }

    const builder: any = new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === 'then') {
            const promise = Promise.resolve(resolve())
            return promise.then.bind(promise)
          }
          if (prop === 'single' || prop === 'maybeSingle') {
            return () => makeThenable(resolve)
          }
          // returns<T>() is a no-op type assertion at runtime.
          if (prop === 'returns') {
            return () => builder
          }
          // All other methods (eq, in, is, gt, or, order, limit, select, insert, update, delete, …)
          return (...args: unknown[]) => tracked(prop, ...args)
        },
      }
    )

    return builder
  }

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table)),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: opts.authUser === null ? null : opts.authUser ?? DEFAULT_USER },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: opts.signOutError ?? null }),
    },
  }

  return {
    supabase,
    fromCalls,
  }
}

/** Convenience: respond to an auth_identities → profiles chain with a known profile id. */
export function authChainResponses(profileId = 'profile-1') {
  return {
    'auth_identities:select': { data: { id: 'identity-1' }, error: null },
    'profiles:select':         { data: { id: profileId }, error: null },
  }
}
