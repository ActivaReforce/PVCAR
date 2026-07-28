import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Compute initial value synchronously to prevent layout shift
const getInitialIsMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Sync in case initial SSR value differs
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
