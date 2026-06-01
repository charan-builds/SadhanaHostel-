"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type RouteTransitionProps = {
  children: ReactNode
  className?: string
}

const routeEase = [0.22, 1, 0.36, 1] as const

export function RouteTransition({ children, className }: RouteTransitionProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className={cn("min-w-0 transform-gpu", className)}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(4px)" }}
        transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: routeEase }}
        style={{ willChange: "opacity, transform, filter" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
