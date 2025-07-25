import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "500", 10)
    // Set a maximum limit to prevent timeout
    const limit = Math.min(requestedLimit, 700)
    const since = searchParams.get("since") // ISO timestamp to get only newer detections

    console.log('Fetching defects with limit:', limit)
    const detections = await cloudStorage.getAllDetections(limit)

    // Filter by timestamp if provided
    const filteredDetections = since
      ? detections.filter((detection) => {
          const detectionTime = new Date(detection.metadata.ProcessingTimestamp).getTime()
          const sinceTime = new Date(since).getTime()
          return detectionTime > sinceTime
        })
      : detections

    console.log(`Returning ${filteredDetections.length} detections`)
    return NextResponse.json({ detections: filteredDetections })
  } catch (error) {
    console.error("Error fetching defects:", error)
    // Return a more specific error message
    return NextResponse.json({ 
      error: "Failed to fetch defects", 
      message: error instanceof Error ? error.message : "Unknown error"
    }, { 
      status: 500 
    })
  }
}
