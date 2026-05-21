import { ResidentDetailClient } from "@/components/admin/residents/resident-detail-client"

type ResidentDetailsPageProps = {
  params: Promise<{ id: string }>
}

export default async function ResidentDetailsPage({ params }: ResidentDetailsPageProps) {
  const { id } = await params

  return <ResidentDetailClient residentId={id} />
}
