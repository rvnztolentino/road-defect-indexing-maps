import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "100", 10)
    const since = searchParams.get("since") // ISO timestamp to get only newer detections

    const detections = await cloudStorage.getAllDetections(limit)

    // Filter by timestamp if provided
    const filteredDetections = since
      ? detections.filter((detection) => {
          const detectionTime = new Date(detection.metadata.ProcessingTimestamp).getTime()
          const sinceTime = new Date(since).getTime()
          return detectionTime > sinceTime
        })
      : detections

    return NextResponse.json({ detections: filteredDetections })
  } catch (error) {
    console.error("Error fetching defects:", error)
    return NextResponse.json({ error: "Failed to fetch defects" }, { status: 500 })
  }
}
