import { useCallback, useSyncExternalStore } from 'react'

type Route =
  | { mode: 'join'; gameCode: null }
  | { mode: 'host-landing'; gameCode: null }
  | { mode: 'host'; gameCode: string }
  | { mode: 'player'; gameCode: string }
  | { mode: 'hack'; gameCode: null }

function getRoute(): Route {
  const path = window.location.pathname
  const params = new URLSearchParams(window.location.search)
  const gameCode = params.get('game') ?? params.get('code')

  if (path === '/hack') return { mode: 'hack' as const, gameCode: null }

  if (path === '/host') {
    if (gameCode) return { mode: 'host', gameCode: gameCode.toUpperCase() }
    return { mode: 'host-landing', gameCode: null }
  }

  if (gameCode) return { mode: 'player', gameCode: gameCode.toUpperCase() }
  return { mode: 'join', gameCode: null }
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

let currentRoute = getRoute()
function getSnapshot() {
  const next = getRoute()
  if (
    next.mode !== currentRoute.mode ||
    next.gameCode !== currentRoute.gameCode
  ) {
    currentRoute = next
  }
  return currentRoute
}

export function useRoute() {
  const route = useSyncExternalStore(subscribe, getSnapshot)

  const navigate = useCallback(
    (path: string, params?: Record<string, string>) => {
      const search = params ? `?${new URLSearchParams(params).toString()}` : ''
      window.history.pushState(null, '', `${path}${search}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    },
    []
  )

  return { ...route, navigate }
}
