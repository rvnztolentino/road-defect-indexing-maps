import { NextResponse } from "next/server"
import { cloudStorage } from "@/lib/cloud-storage"

export async function GET() {
  try {
    // Check if storage is ready
    const isReady = await cloudStorage.isReady()

    if (!isReady) {
      return NextResponse.json(
        {
          success: false,
          message: "Google Cloud Storage is not ready",
          error: "Storage initialization failed or bucket is not accessible",
          environment: {
            projectId: process.env.GOOGLE_PROJECT_ID ? "✓ Set" : "✗ Missing",
            bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME ? "✓ Set" : "✗ Missing",
            region: process.env.GOOGLE_CLOUD_REGION ? "✓ Set" : "✗ Missing",
            folderPath: process.env.GOOGLE_CLOUD_FOLDER_PATH ? "✓ Set" : "✗ Missing",
          },
          troubleshooting: [
            "Verify that your Google Cloud project ID is correct",
            "Ensure the bucket name exists and is accessible",
            "Make sure you're authenticated with Google Cloud (run 'gcloud auth application-default login')",
            "Verify that the service account has the necessary permissions",
          ],
        },
        { status: 500 },
      )
    }

    // Test listing metadata files
    const metadataFiles = await cloudStorage.listMetadataFiles()

    // Test getting a sample detection if files exist
    let sampleDetection = null
    if (metadataFiles.length > 0) {
      try {
        const sampleMetadata = await cloudStorage.getMetadata(metadataFiles[0])
        if (sampleMetadata) {
          const imageBlobName = metadataFiles[0].replace(/\.json$/, ".jpg")
          const imageUrl = await cloudStorage.getSignedUrl(imageBlobName)
          sampleDetection = {
            metadata: sampleMetadata,
            imageUrl: imageUrl ? "✓ Generated" : "✗ Failed",
          }
        }
      } catch (e) {
        console.error("Error testing sample detection:", e)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Google Cloud Storage connection successful",
      fileCount: metadataFiles.length,
      sampleFiles: metadataFiles.slice(0, 5),
      sampleDetection,
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
        troubleshooting: [
          "Check that all environment variables are set correctly",
          "Verify your Google Cloud project exists and is active",
          "Ensure the bucket exists in the specified project",
          "Make sure you're authenticated with Google Cloud (run 'gcloud auth application-default login')",
        ],
      },
      { status: 500 },
    )
  }
}
