"use client"
import { useEffect, useRef } from "react"

export default function useEventListener<K extends keyof WindowEventMap>(
  eventType: K,
  callback: (event: WindowEventMap[K]) => void,
  element: HTMLElement | Window | Document | null = typeof window !== "undefined" ? window : null
): void {
  const callbackRef = useRef(callback)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (typeof window === "undefined") return; // Exit early on server

    const targetElement = element ?? window;

    
    const handler = (e: Event) => {
      callbackRef.current(e as WindowEventMap[K])
    }
    
    targetElement.addEventListener(eventType as string, handler)

    return () => targetElement.removeEventListener(eventType as string, handler)
  }, [eventType, element])
}