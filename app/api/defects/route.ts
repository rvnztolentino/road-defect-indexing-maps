import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10)

    const detections = await cloudStorage.getAllDetections(limit)

    return NextResponse.json({ detections })
  } catch (error) {
    console.error("Error fetching defects:", error)
    return NextResponse.json({ error: "Failed to fetch defects" }, { status: 500 })
  }
}
