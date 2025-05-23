import { Storage } from "@google-cloud/storage"

interface CloudStorageSettings {
  projectId: string
  bucketName: string
  region: string
  folderPath: string
}

export interface DefectMetadata {
  [x: string]: any
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
   * Initialize cloud storage client using credentials from environment variable
   */
  public initialize(): boolean {
    try {
      // Check if required settings are present
      if (!this.settings.projectId || !this.settings.bucketName) {
        this.logger.warn("Cloud storage not initialized - missing required settings")
        this.logger.warn(`Project ID: ${this.settings.projectId}`)
        this.logger.warn(`Bucket Name: ${this.settings.bucketName}`)
        return false
      }

      const path = require('path')
      const keyPath = path.join(process.cwd(), 'google_key.json')
      
      this.logger.info(`Using credentials file at: ${keyPath}`)
      
      // Initialize client with keyFilename
      this.client = new Storage({ 
        projectId: this.settings.projectId, 
        keyFilename: keyPath
      })

      // Get bucket
      this.bucket = this.client.bucket(this.settings.bucketName)
      this.logger.info(`Attempting to connect to bucket: ${this.settings.bucketName}`)

      // Test the connection
      this.testConnection()

      return true
    } catch (e) {
      this.logger.error(`Cloud storage initialization error: ${e}`)
      if (e instanceof Error) {
        this.logger.error(`Error details: ${e.message}`)
        this.logger.error(`Error stack: ${e.stack}`)
      }
      this.isInitialized = false
      return false
    }
  }

  /**
   * Test the connection to verify authentication and bucket access
   */
  private async testConnection(): Promise<void> {
    try {
      if (!this.bucket) {
        throw new Error("Bucket not initialized")
      }

      // Try to check if bucket exists
      const [exists] = await this.bucket.exists()
      if (!exists) {
        this.logger.warn(`Cloud storage not initialized - bucket ${this.settings.bucketName} does not exist`)
        this.isInitialized = false
      } else {
        this.isInitialized = true
        this.logger.info("Cloud storage initialized successfully")
      }
    } catch (e) {
      this.logger.error(`Cloud storage connection test failed: ${e}`)
      this.isInitialized = false
    }
  }

  /**
   * Check if the storage is properly initialized
   */
  public async isReady(): Promise<boolean> {
    if (!this.client || !this.bucket) {
      return false
    }

    try {
      // Test the connection
      await this.testConnection()
      return this.isInitialized
    } catch (e) {
      this.logger.error(`Storage readiness check failed: ${e}`)
      return false
    }
  }

  /**
   * List all JSON metadata files in cloud storage
   */
  public async listMetadataFiles(): Promise<string[]> {
    const isReady = await this.isReady()
    if (!isReady) {
      this.logger.warn("Cloud storage not ready - cannot list metadata files")
      return []
    }

    try {
      // List blobs in folder
      const folderPath = this.settings.folderPath.replace(/\/$/, "")
      const [files] = await this.bucket.getFiles({
        prefix: folderPath,
        maxResults: 1000, // Limit to prevent timeout
      })

      // Filter for JSON files
      const metadataFiles = files.filter((file: { name: string }) => file.name.endsWith(".json")).map((file: { name: any }) => file.name)

      this.logger.info(`Found ${metadataFiles.length} metadata files`)
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
    const isReady = await this.isReady()
    if (!isReady) {
      this.logger.warn("Cloud storage not ready - cannot get signed URL")
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
      this.logger.error(`Error getting signed URL for ${blobName}: ${e}`)
      return ""
    }
  }

  /**
   * Get metadata from a JSON file
   */
  public async getMetadata(jsonBlobName: string): Promise<DefectMetadata | null> {
    const isReady = await this.isReady()
    if (!isReady) {
      this.logger.warn("Cloud storage not ready - cannot get metadata")
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
      const metadata = JSON.parse(jsonContent.toString())

      // Validate that required fields exist
      if (!metadata.GPSLocation || !Array.isArray(metadata.GPSLocation) || metadata.GPSLocation.length !== 2) {
        this.logger.warn(`Invalid GPS location in ${jsonBlobName}`)
        return null
      }

      return metadata
    } catch (e) {
      this.logger.error(`Error getting metadata from ${jsonBlobName}: ${e}`)
      return null
    }
  }

  /**
   * Get all defect detections with metadata and signed URLs
   */
  public async getAllDetections(limit = 100): Promise<DefectDetection[]> {
    const isReady = await this.isReady()
    if (!isReady) {
      this.logger.warn("Cloud storage not ready - cannot get detections")
      return []
    }

    try {
      const jsonBlobNames = await this.listMetadataFiles()
      const limitedBlobNames = jsonBlobNames.slice(0, limit)

      const detections: DefectDetection[] = []

      // Process files in batches to avoid overwhelming the API
      const batchSize = 10
      for (let i = 0; i < limitedBlobNames.length; i += batchSize) {
        const batch = limitedBlobNames.slice(i, i + batchSize)

        const batchPromises = batch.map(async (jsonBlobName) => {
          try {
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

              return {
                id,
                name: jsonBlobName,
                imageUrl,
                metadata,
                location: metadata.GPSLocation,
              }
            }
            return null
          } catch (e) {
            this.logger.error(`Error processing ${jsonBlobName}: ${e}`)
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        const validDetections = batchResults.filter((detection): detection is DefectDetection => detection !== null)
        detections.push(...validDetections)
      }

      this.logger.info(`Successfully processed ${detections.length} detections`)
      return detections
    } catch (e) {
      this.logger.error(`Error getting all detections: ${e}`)
      return []
    }
  }
}

// Export singleton instance
export const cloudStorage = new CloudStorage()
