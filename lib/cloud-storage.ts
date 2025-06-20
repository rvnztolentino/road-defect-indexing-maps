import { Storage, Bucket } from "@google-cloud/storage"
import type { DefectDetection, DefectMetadata } from "./types"

interface CloudStorageSettings {
  projectId: string
  bucketName: string
  region: string
  folderPath: string
}

interface StorageFile {
  name: string
}

class CloudStorage {
  private logger: Console
  private client: Storage | null = null
  private bucket: Bucket | null = null
  private isInitialized = false
  private settings: CloudStorageSettings

  constructor() {
    this.logger = console

    // Get settings from environment
    this.settings = {
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || "",
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

      // Initialize client with environment variables
      this.client = new Storage({
        projectId: this.settings.projectId,
        credentials: {
          type: "service_account",
          project_id: this.settings.projectId,
          private_key_id: process.env.GOOGLE_CLOUD_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
          client_id: process.env.GOOGLE_CLOUD_CLIENT_ID,
        },
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
    if (!isReady || !this.bucket) {
      this.logger.warn("Cloud storage not ready - cannot list metadata files")
      return []
    }

    try {
      // List blobs in folder
      const folderPath = this.settings.folderPath.replace(/\/$/, "")
      const [files] = await this.bucket.getFiles({
        prefix: folderPath,
        maxResults: 300, // Set limit
      })

      // Filter for JSON files
      const metadataFiles = files
        .filter((file: StorageFile) => file.name.endsWith(".json"))
        .map((file: StorageFile) => file.name)

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
    if (!isReady || !this.bucket) {
      this.logger.warn("Cloud storage not ready - cannot get signed URL")
      return ""
    }

    try {
      const file = this.bucket.file(blobName)
      const [exists] = await file.exists()
      
      if (!exists) {
        this.logger.warn(`File not found: ${blobName}`)
        return ""
      }

      // Get file metadata to verify it's accessible
      const [metadata] = await file.getMetadata()
      this.logger.info(`File metadata for ${blobName}:`, {
        size: metadata.size,
        contentType: metadata.contentType,
        updated: metadata.updated
      })

      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      })
      
      this.logger.info(`Generated signed URL for ${blobName}: ${url}`)
      return url
    } catch (e) {
      this.logger.error(`Error getting signed URL for ${blobName}: ${e}`)
      if (e instanceof Error) {
        this.logger.error(`Error details: ${e.message}`)
        this.logger.error(`Error stack: ${e.stack}`)
      }
      return ""
    }
  }

  /**
   * Get metadata from a JSON file
   */
  public async getMetadata(jsonBlobName: string): Promise<DefectMetadata | null> {
    const isReady = await this.isReady()
    if (!isReady || !this.bucket) {
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
   * @param limit Maximum number of detections to return
   */
  public async getAllDetections(limit = 10000): Promise<DefectDetection[]> {
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
      const batchSize = 20 // Increased batch size for better performance
      for (let i = 0; i < limitedBlobNames.length; i += batchSize) {
        const batch = limitedBlobNames.slice(i, i + batchSize)

        const batchPromises = batch.map(async (jsonBlobName) => {
          try {
            const metadata = await this.getMetadata(jsonBlobName)

            if (metadata && metadata.GPSLocation) {
              // Get corresponding image URL - handle both with and without _metadata suffix
              const baseName = jsonBlobName.replace(/\.json$/, "")
              const imageBlobName = baseName.endsWith("_metadata") 
                ? baseName.replace(/_metadata$/, ".jpg")
                : `${baseName}.jpg`
              const imageUrl = await this.getSignedUrl(imageBlobName)

              // Extract ID from filename
              const id = baseName.endsWith("_metadata")
                ? baseName.replace(/_metadata$/, "")
                : baseName

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
