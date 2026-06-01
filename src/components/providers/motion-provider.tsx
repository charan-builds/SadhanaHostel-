"use client"

import type { ReactNode } from "react"
import { MotionConfig } from "framer-motion"

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionConfig>
  )
}
