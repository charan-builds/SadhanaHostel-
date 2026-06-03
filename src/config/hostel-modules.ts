export const hostelModules = {
  rooms: false,
  roomAllocation: false,
  reservations: false,
  vacancy: false,
  launchReadiness: true,
  maintenance: true,
} as const

export function isAdminModuleEnabled(
  moduleName: keyof typeof hostelModules
) {
  return hostelModules[moduleName]
}
