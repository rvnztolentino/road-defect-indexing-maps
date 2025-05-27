import { NextRequest, NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params
    const id = params.id
    const folderPath = process.env.GOOGLE_CLOUD_FOLDER_PATH || ""
    const blobName = `${folderPath.replace(/\/$/, "")}/detection_${id}.json`

    const imageUrl = await cloudStorage.getSignedUrl(blobName.replace('.json', '.jpg'))
    const metadata = await cloudStorage.getMetadata(blobName)

    if (!metadata) {
      return NextResponse.json({ error: "Defect not found" }, { status: 404 })
    }

    return NextResponse.json({
      id,
      name: blobName,
      imageUrl,
      metadata,
      location: metadata.GPSLocation,
    })
  } catch (error) {
    console.error("Error fetching defect:", error)
    return NextResponse.json({ error: "Failed to fetch defect" }, { status: 500 })
  }
}
