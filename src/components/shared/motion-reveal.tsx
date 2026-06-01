"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"

import { cn } from "@/lib/utils"

type MotionRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
}

export function MotionReveal({ children, className, delay = 0 }: MotionRevealProps) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ willChange: reduceMotion ? undefined : "opacity, transform, filter" }}
    >
      {children}
    </motion.div>
  )
}
