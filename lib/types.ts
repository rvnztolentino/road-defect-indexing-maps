export interface DefectMetadata {
  GPSLocation: [number, number] // [latitude, longitude]
  SeverityLevel: number // 0-1 float value
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