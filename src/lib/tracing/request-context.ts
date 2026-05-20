import { AsyncLocalStorage } from "node:async_hooks"

export type RequestContext = {
  requestId: string
  route?: string
  method?: string
  path?: string
  userId?: string | null
  organizationId?: string | null
  startedAt: number
}

const requestContext = new AsyncLocalStorage<RequestContext>()

export function generateRequestId() {
  return crypto.randomUUID()
}

export function getRequestContext() {
  return requestContext.getStore()
}

export function getRequestId() {
  return getRequestContext()?.requestId ?? generateRequestId()
}

export async function runWithRequestContext<T>(
  context: RequestContext,
  callback: () => Promise<T>
) {
  return requestContext.run(context, callback)
}

export function enrichRequestContext(values: Partial<RequestContext>) {
  const context = getRequestContext()

  if (!context) {
    return
  }

  Object.assign(context, values)
}
