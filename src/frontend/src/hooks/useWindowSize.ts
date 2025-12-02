"use client"
import { useState, useEffect } from "react"
import useEventListener from "./useEventListener"

export default function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
    maxWidth: 1480
   })

  useEventListener("resize", () => {
    setWindowSize(prev=>{
      return {...prev, width: window.innerWidth, height: window.innerHeight}
    })
  })

  useEffect(() => {
    setWindowSize(prev=>{
      return {...prev, width: window.innerWidth, height: window.innerHeight}
    }) 
  }, [])
 

  return windowSize
}