"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import Image from "next/image"
import type { DefectDetection } from "@/lib/cloud-storage"

interface RecentDefectsProps {
  onSelectDefect?: (defect: DefectDetection) => void
}

export function RecentDefects({ onSelectDefect }: RecentDefectsProps) {
  const [defects, setDefects] = useState<DefectDetection[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecentDefects = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/defects?limit=10")
      const data = await response.json()

      if (data.detections) {
        setDefects(data.detections)
      }
    } catch (error) {
      console.error("Error fetching recent defects:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecentDefects()

    // Set up refresh interval (every 30 seconds)
    const interval = setInterval(fetchRecentDefects, 30000)

    return () => clearInterval(interval)
  }, [])

  // Format ISO datetime to readable format
  const formatDateTime = (isoString: string): string => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString()
    } catch (e) {
      return isoString
    }
  }

  // Get severity color class
  const getSeverityColorClass = (severity: string): string => {
    switch (severity) {
      case "High":
        return "text-red-500"
      case "Moderate":
        return "text-yellow-500"
      case "Low":
        return "text-green-500"
      default:
        return "text-blue-500"
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Recent Defects</h3>
        <Button variant="ghost" size="sm" onClick={fetchRecentDefects} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          <span className="text-xs">Refresh</span>
        </Button>
      </div>

      {defects.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-4">
          {loading ? "Loading defects..." : "No recent defects found"}
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {defects.map((defect) => (
            <Card
              key={defect.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onSelectDefect?.(defect)}
            >
              <CardContent className="p-2">
                <div className="flex gap-2">
                  <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={defect.imageUrl || "/placeholder.svg?height=64&width=64"}
                      alt="Defect"
                      className="object-cover w-full h-full"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-medium truncate">{defect.metadata.DominantDefectType}</p>
                      <span className={`text-xs font-medium ${getSeverityColorClass(defect.metadata.SeverityLevel)}`}>
                        {defect.metadata.SeverityLevel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(defect.metadata.ProcessingTimestamp)}
                    </p>
                    <p className="text-xs">
                      {Object.keys(defect.metadata.DefectCounts).length} defect types,
                      {defect.metadata.RealWorldArea.toFixed(1)} m²
                    </p>
                    <p className="text-xs">Repair: {Math.round(defect.metadata.RepairProbability * 100)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
