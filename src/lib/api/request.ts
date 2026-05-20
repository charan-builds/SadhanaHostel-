import { badRequest } from "@/lib/api/api-error"

export async function parseJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw badRequest("Request body must be valid JSON.")
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw badRequest("Request body must be a JSON object.")
  }

  return body as Record<string, unknown>
}

export function getQueryParams(request: Request) {
  const url = new URL(request.url)

  return Object.fromEntries(url.searchParams.entries())
}

export async function parseMultipartForm(request: Request) {
  try {
    return await request.formData()
  } catch {
    throw badRequest("Request body must be multipart/form-data.")
  }
}

export function getRequiredFile(formData: FormData, fieldName = "file") {
  const file = formData.get(fieldName)

  if (!(file instanceof File)) {
    throw badRequest(`Multipart field "${fieldName}" must contain a file.`)
  }

  return file
}

export function formDataToObject(formData: FormData) {
  const payload: Record<string, unknown> = {}

  formData.forEach((value, key) => {
    if (value instanceof File) {
      return
    }

    payload[key] = value
  })

  return payload
}
