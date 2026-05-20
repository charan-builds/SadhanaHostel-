import {
  createdResponse,
  errorResponse,
  formDataToObject,
  getRequiredFile,
  parseMultipartForm,
} from "@/lib/api"
import { UploadsService } from "@/services/uploads.service"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const formData = await parseMultipartForm(request)
    const file = getRequiredFile(formData)
    const service = await UploadsService.create()
    const result = await service.uploadDocument(formDataToObject(formData), file)

    return createdResponse(result, "Document uploaded successfully.")
  } catch (error) {
    return errorResponse(error)
  }
}
