import { vi } from "vitest"

export function createServiceFactoryMock<TService extends object>(service: TService) {
  return {
    create: vi.fn().mockResolvedValue(service),
  }
}
