import "server-only"

import { createSupabaseServerClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/repositories/types"
import { globalSearchSchema } from "@/validations/search.validation"

import { AuthService } from "../auth.service"
import { SearchRepository } from "./search.repository"

export class SearchService {
  private readonly authService: AuthService
  private readonly searchRepository: SearchRepository

  constructor(private readonly db: AppSupabaseClient) {
    this.authService = new AuthService(db)
    this.searchRepository = new SearchRepository(db)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new SearchService(db)
  }

  async search(input: unknown) {
    const values = globalSearchSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    return this.searchRepository.search(values)
  }
}
