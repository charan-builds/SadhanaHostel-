export type PublicRedirect = {
  source: string
  destination: string
  permanent: boolean
}

export async function publicRedirects(): Promise<PublicRedirect[]> {
  return [
    {
      source: "/login",
      destination: "/admin/login",
      permanent: false,
    },
    {
      source: "/hostel-in-pulivendula",
      destination: "/pulivendula-boys-hostel",
      permanent: true,
    },
    {
      source: "/boys-hostel-pulivendula",
      destination: "/pulivendula-boys-hostel",
      permanent: true,
    },
  ]
}
