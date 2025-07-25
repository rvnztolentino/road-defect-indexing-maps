"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import Image from "next/image"
import type { DefectDetection } from "@/lib/types"

interface RecentDefectsProps {
  onSelectDefect?: (defect: DefectDetection) => void
}

export function RecentDefects({ onSelectDefect }: RecentDefectsProps) {
  const [defects, setDefects] = useState<DefectDetection[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecentDefects = async () => {
    setLoading(true)
    try {
      // Limit to 50 most recent defects
      const response = await fetch("/api/defects?limit=50")
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
    } catch (error) {
      console.error("Error formatting date:", error)
      return isoString
    }
  }

  // Get severity color class
  const getSeverityColorClass = (severity: number): string => {
    const roundedSeverity = Math.round(severity * 100) / 100
    if (roundedSeverity >= 0.5) {
      return "text-red-500"
    } else if (roundedSeverity >= 0.3) {
      return "text-yellow-500"
    } else {
      return "text-green-500"
    }
  }

  // Format severity level for display
  const formatSeverityLevel = (severity: number): string => {
    const roundedSeverity = Math.round(severity * 100) / 100
    if (roundedSeverity >= 0.5) {
      return "Severe"
    } else if (roundedSeverity >= 0.3) {
      return "Moderate"
    } else {
      return "Low"
    }
  }

  const handleDefectSelect = (defect: DefectDetection) => {
    // First trigger the onSelectDefect callback to locate the defect on the map
    onSelectDefect?.(defect)
    
    // Then trigger a click on the marker after a short delay to ensure the map has moved
    setTimeout(() => {
      const marker = document.querySelector(`[data-defect-id="${defect.id}"]`)
      if (marker) {
        marker.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        }))
      }
    }, 500) // Small delay to ensure map movement is complete
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
        <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
          {defects.map((defect) => (
            <Card
              key={defect.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => {
                handleDefectSelect?.(defect);
                onSelectDefect?.(defect);
              }}
            >
              <CardContent className="p-2">
                <div className="flex gap-2">
                  <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                    <Image
                      src={defect.imageUrl || "/placeholder.svg?height=64&width=64"}
                      alt="Defect"
                      fill
                      className="object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/placeholder.svg?height=64&width=64";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-medium truncate">{defect.metadata.DominantDefectType}</p>
                      <span className={`text-xs font-medium ${getSeverityColorClass(defect.metadata.SeverityLevel)}`}>
                        {formatSeverityLevel(defect.metadata.SeverityLevel)} ({(defect.metadata.SeverityLevel * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(defect.metadata.ProcessingTimestamp)}
                    </p>
                    <p className="text-xs">
                      {Object.entries(defect.metadata.DefectCounts)
                        .map(([type, count]) => `${type}: ${count}`)
                        .join(", ")}
                    </p>
                    <p className="text-xs">Repair: {defect.metadata.RepairProbability === 1 ? "Yes" : "No"}</p>
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
