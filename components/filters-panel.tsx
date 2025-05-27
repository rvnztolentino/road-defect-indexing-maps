"use client"

import { useState, useEffect } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import type { DefectDetection } from "@/lib/types"

interface FiltersPanelProps {
  selectedDefectType: string | null
  setSelectedDefectType: (type: string | null) => void
}

export function FiltersPanel({ selectedDefectType, setSelectedDefectType }: FiltersPanelProps) {
  const [defectTypes, setDefectTypes] = useState<string[]>([])

  // Fetch available defect types from the API
  useEffect(() => {
    const fetchDefectTypes = async () => {
      try {
        const response = await fetch("/api/defects?limit=50")
        const data = await response.json()

        if (data.detections && data.detections.length > 0) {
          // Extract unique defect types from the detections
          const uniqueTypes = new Set<string>()
          data.detections.forEach((detection: DefectDetection) => {
            Object.keys(detection.metadata.DefectCounts).forEach((type) => {
              uniqueTypes.add(type)
            })
            // Also add dominant defect type if not already included
            uniqueTypes.add(detection.metadata.DominantDefectType)
          })

          setDefectTypes(Array.from(uniqueTypes).sort())
        }
      } catch (error) {
        console.error("Error fetching defect types:", error)
      }
    }

    fetchDefectTypes()
  }, [])

  const handleDefectTypeChange = (value: string) => {
    setSelectedDefectType(value)
  }

  const clearFilters = () => {
    setSelectedDefectType(null)
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <p className="text-sm text-muted-foreground mb-4">Filter road defects by type</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium mb-3">Defect Type</h3>
            <RadioGroup value={selectedDefectType || ""} onValueChange={handleDefectTypeChange} className="space-y-2">
              {defectTypes.map((type) => (
                <div key={type} className="flex items-center space-x-2">
                  <RadioGroupItem value={type} id={type} />
                  <Label htmlFor={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Button variant="outline" size="sm" onClick={clearFilters} disabled={!selectedDefectType} className="w-full">
            Clear Filters
          </Button>
        </div>
      </div>
    </div>
  )
}
