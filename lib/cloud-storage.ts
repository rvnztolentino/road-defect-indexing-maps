import { Storage } from "@google-cloud/storage"
import path from "path"
import fs from "fs"

interface CloudStorageSettings {
  projectId: string
  bucketName: string
  region: string
  folderPath: string
}

export interface DefectMetadata {
  timestamp: string
  defect_counts: Record<string, number>
  frame_counts: Record<string, number>
  location?: [number, number] // [latitude, longitude]
  project_id?: string
  region?: string
  bucket?: string
  folder_path?: string
  bboxes?: Array<{
    x1: number
    y1: number
    x2: number
    y2: number
    class?: string
    confidence?: number
  }>
}

export interface DefectDetection {
  id: string
  name: string
  imageUrl: string
  metadata: DefectMetadata
  location: [number, number]
}

class CloudStorage {
  private logger: Console
  private client: Storage | null = null
  private bucket: any = null
  private isInitialized = false
  private settings: CloudStorageSettings

  constructor() {
    this.logger = console

    // Get settings from environment
    this.settings = {
      projectId: process.env.GOOGLE_PROJECT_ID || "",
      bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || "",
      region: process.env.GOOGLE_CLOUD_REGION || "",
      folderPath: process.env.GOOGLE_CLOUD_FOLDER_PATH || "",
    }

    // Try to initialize
    this.initialize()
  }

  /**
   * Initialize cloud storage client
   */
  public initialize(): boolean {
    try {
      // Check if credentials file exists
      const credentialsPath = path.join(process.cwd(), "config", "credentials.json")
      if (!fs.existsSync(credentialsPath)) {
        this.logger.warn("Cloud storage not initialized - credentials file not found")
        return false
      }

      // Check if required settings are present
      if (!this.settings.projectId || !this.settings.bucketName) {
        this.logger.warn("Cloud storage not initialized - missing required settings")
        return false
      }

      // Initialize client
      this.client = new Storage({
        projectId: this.settings.projectId,
        keyFilename: credentialsPath,
      })

      // Get bucket
      this.bucket = this.client.bucket(this.settings.bucketName)

      // Verify bucket exists (this is async in Node.js, so we'll just log success)
      this.bucket.exists().then((data: [boolean]) => {
        const exists = data[0]
        if (!exists) {
          this.logger.warn(`Cloud storage not initialized - bucket ${this.settings.bucketName} does not exist`)
          this.isInitialized = false
        } else {
          this.isInitialized = true
          this.logger.info("Cloud storage initialized successfully")
        }
      })

      return true
    } catch (e) {
      this.logger.error(`Cloud storage not initialized: ${e}`)
      this.isInitialized = false
      return false
    }
  }

  /**
   * List all detections in cloud storage
   */
  public async listDetections(): Promise<string[]> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot list detections")
      return []
    }

    try {
      // List blobs in folder
      const folderPath = this.settings.folderPath.replace(/\/$/, "")
      const [files] = await this.bucket.getFiles({ prefix: folderPath })

      // Filter for image files
      const detections = files
        .filter((file: { name: string }) => file.name.endsWith(".jpg") || file.name.endsWith(".jpeg"))
        .map((file: { name: any }) => file.name)

      return detections.sort().reverse() // Most recent first
    } catch (e) {
      this.logger.error(`Error listing detections: ${e}`)
      return []
    }
  }

  /**
   * Get signed URL for a blob
   */
  public async getSignedUrl(blobName: string): Promise<string> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot get signed URL")
      return ""
    }

    try {
      const file = this.bucket.file(blobName)
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      })
      return url
    } catch (e) {
      this.logger.error(`Error getting signed URL: ${e}`)
      return ""
    }
  }

  /**
   * Get metadata for a detection
   */
  public async getMetadata(blobName: string): Promise<DefectMetadata | null> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot get metadata")
      return null
    }

    try {
      // First, check if there's a corresponding JSON file
      const jsonBlobName = blobName.replace(/\.(jpg|jpeg)$/, ".json")
      const jsonFile = this.bucket.file(jsonBlobName)
      const [jsonExists] = await jsonFile.exists()

      if (jsonExists) {
        // If JSON file exists, download and parse it
        const [jsonContent] = await jsonFile.download()
        return JSON.parse(jsonContent.toString())
      } else {
        // Otherwise, we'll need to extract EXIF data from the image
        // This would typically be done with a library like ExifReader
        // For this example, we'll return a placeholder with a note
        this.logger.warn(`No JSON metadata file found for ${blobName}. EXIF extraction would be needed.`)

        // Extract timestamp from filename (detection_YYYYMMDD_HHMMSS.jpg)
        const timestampMatch = blobName.match(/detection_(\d{8}_\d{6})\.jpe?g/)
        const timestamp = timestampMatch ? timestampMatch[1] : "unknown"

        // Generate random location near Manila for demo purposes
        const lat = 14.5995 + (Math.random() - 0.5) * 0.02
        const lng = 120.9842 + (Math.random() - 0.5) * 0.02

        return {
          timestamp,
          defect_counts: { pothole: Math.floor(Math.random() * 5) + 1 },
          frame_counts: { total: 1 },
          location: [lat, lng],
          project_id: this.settings.projectId,
          region: this.settings.region,
          bucket: this.settings.bucketName,
          folder_path: this.settings.folderPath,
        }
      }
    } catch (e) {
      this.logger.error(`Error getting metadata: ${e}`)
      return null
    }
  }

  /**
   * Get all detections with metadata and signed URLs
   */
  public async getAllDetections(limit = 50): Promise<DefectDetection[]> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot get detections")
      return []
    }

    try {
      const blobNames = await this.listDetections()
      const limitedBlobNames = blobNames.slice(0, limit)

      const detections: DefectDetection[] = []

      for (const blobName of limitedBlobNames) {
        const imageUrl = await this.getSignedUrl(blobName)
        const metadata = await this.getMetadata(blobName)

        if (metadata && metadata.location) {
          detections.push({
            id:
              blobName
                .split("/")
                .pop()
                ?.replace(/\.(jpg|jpeg)$/, "") || "",
            name: blobName,
            imageUrl,
            metadata,
            location: metadata.location,
          })
        }
      }

      return detections
    } catch (e) {
      this.logger.error(`Error getting all detections: ${e}`)
      return []
    }
  }
}

// Export singleton instance
export const cloudStorage = new CloudStorage()
