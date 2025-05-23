import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
    googleProjectId: process.env.GOOGLE_PROJECT_ID,
    googleCloudBucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME,
    googleCloudRegion: process.env.GOOGLE_CLOUD_REGION,
    googleCloudFolderPath: process.env.GOOGLE_CLOUD_FOLDER_PATH,
    configStatus: {
      mapboxToken: !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      googleProjectId: !!process.env.GOOGLE_PROJECT_ID,
      googleCloudBucketName: !!process.env.GOOGLE_CLOUD_BUCKET_NAME,
      googleCloudRegion: !!process.env.GOOGLE_CLOUD_REGION,
      googleCloudFolderPath: !!process.env.GOOGLE_CLOUD_FOLDER_PATH,
    },
  })
}
