import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET() {
  try {
    // Test the cloud storage connection
    const metadataFiles = await cloudStorage.listMetadataFiles()

    return NextResponse.json({
      success: true,
      message: "Google Cloud Storage connection successful",
      fileCount: metadataFiles.length,
      sampleFiles: metadataFiles.slice(0, 5), // Show first 5 files as sample
      environment: {
        projectId: process.env.GOOGLE_PROJECT_ID ? "✓ Set" : "✗ Missing",
        bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME ? "✓ Set" : "✗ Missing",
        region: process.env.GOOGLE_CLOUD_REGION ? "✓ Set" : "✗ Missing",
        folderPath: process.env.GOOGLE_CLOUD_FOLDER_PATH ? "✓ Set" : "✗ Missing",
      },
    })
  } catch (error) {
    console.error("Google Cloud Storage test failed:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Google Cloud Storage connection failed",
        error: error instanceof Error ? error.message : "Unknown error",
        environment: {
          projectId: process.env.GOOGLE_PROJECT_ID ? "✓ Set" : "✗ Missing",
          bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME ? "✓ Set" : "✗ Missing",
          region: process.env.GOOGLE_CLOUD_REGION ? "✓ Set" : "✗ Missing",
          folderPath: process.env.GOOGLE_CLOUD_FOLDER_PATH ? "✓ Set" : "✗ Missing",
        },
      },
      { status: 500 },
    )
  }
}
