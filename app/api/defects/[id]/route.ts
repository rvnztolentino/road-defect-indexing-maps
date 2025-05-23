import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id
    const folderPath = process.env.GOOGLE_CLOUD_FOLDER_PATH || ""
    const blobName = `${folderPath.replace(/\/$/, "")}/detection_${id}.jpg`

    const imageUrl = await cloudStorage.getSignedUrl(blobName)
    const metadata = await cloudStorage.getMetadata(blobName)

    if (!metadata) {
      return NextResponse.json({ error: "Defect not found" }, { status: 404 })
    }

    return NextResponse.json({
      id,
      name: blobName,
      imageUrl,
      metadata,
      location: metadata.location,
    })
  } catch (error) {
    console.error("Error fetching defect:", error)
    return NextResponse.json({ error: "Failed to fetch defect" }, { status: 500 })
  }
}
