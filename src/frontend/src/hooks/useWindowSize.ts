"use client"
import { useState, useEffect } from "react"
import useEventListener from "./useEventListener"

export default function useWindowSize() {
  const [windowSize, setWindowSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight, maxWidth: 1480 }
    }
    return { width: 0, height: 0, maxWidth: 1480 }
  })

  useEventListener("resize", () => {
    setWindowSize(prev => {
      return { ...prev, width: window.innerWidth, height: window.innerHeight }
    })
  })


  return windowSize
}