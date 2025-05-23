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
  GPSLocation: [number, number] // [latitude, longitude]
  SeverityLevel: string // "Low", "Moderate", "High"
  RealWorldArea: number // square meters
  DefectPixelCount: number
  TotalPixelCount: number
  DistanceToObject: number // meters
  ImageShape: [number, number, number] // [height, width, channels]
  ProcessingTimestamp: string // ISO datetime
  FuzzySeverity: number // 0-1
  RepairProbability: number // 0-1
  DefectCounts: Record<string, number> // { "pothole": 2, "crack": 1, ... }
  AverageLength: number // cm
  AverageWidth: number // cm
  DefectRatio: number // defect pixels / bbox area
  DominantDefectType: string
}

export interface DefectDetection {
  id: string
  name: string
  imageUrl: string
  metadata: DefectMetadata
  location: [number, number] // [latitude, longitude]
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
   * List all JSON metadata files in cloud storage
   */
  public async listMetadataFiles(): Promise<string[]> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot list metadata files")
      return []
    }

    try {
      // List blobs in folder
      const folderPath = this.settings.folderPath.replace(/\/$/, "")
      const [files] = await this.bucket.getFiles({ prefix: folderPath })

      // Filter for JSON files
      const metadataFiles = files.filter((file: { name: string }) => file.name.endsWith(".json")).map((file: { name: string }) => file.name)

      return metadataFiles.sort().reverse() // Most recent first
    } catch (e) {
      this.logger.error(`Error listing metadata files: ${e}`)
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
   * Get metadata from a JSON file
   */
  public async getMetadata(jsonBlobName: string): Promise<DefectMetadata | null> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot get metadata")
      return null
    }

    try {
      const jsonFile = this.bucket.file(jsonBlobName)
      const [jsonExists] = await jsonFile.exists()

      if (!jsonExists) {
        this.logger.warn(`JSON file not found: ${jsonBlobName}`)
        return null
      }

      // Download and parse JSON file
      const [jsonContent] = await jsonFile.download()
      return JSON.parse(jsonContent.toString())
    } catch (e) {
      this.logger.error(`Error getting metadata: ${e}`)
      return null
    }
  }

  /**
   * Get all defect detections with metadata and signed URLs
   */
  public async getAllDetections(limit = 100): Promise<DefectDetection[]> {
    if (!this.isInitialized) {
      this.logger.warn("Cloud storage not initialized - cannot get detections")
      return []
    }

    try {
      const jsonBlobNames = await this.listMetadataFiles()
      const limitedBlobNames = jsonBlobNames.slice(0, limit)

      const detections: DefectDetection[] = []

      for (const jsonBlobName of limitedBlobNames) {
        const metadata = await this.getMetadata(jsonBlobName)

        if (metadata && metadata.GPSLocation) {
          // Get corresponding image URL
          const imageBlobName = jsonBlobName.replace(/\.json$/, ".jpg")
          const imageUrl = await this.getSignedUrl(imageBlobName)

          // Extract ID from filename
          const id =
            jsonBlobName
              .split("/")
              .pop()
              ?.replace(/\.json$/, "") || ""

          detections.push({
            id,
            name: jsonBlobName,
            imageUrl,
            metadata,
            location: metadata.GPSLocation,
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
