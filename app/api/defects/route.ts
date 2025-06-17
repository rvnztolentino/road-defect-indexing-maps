import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "1000", 10)
    // Set a maximum limit of 5000 to prevent server overload
    const limit = Math.min(requestedLimit, 5000)
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
