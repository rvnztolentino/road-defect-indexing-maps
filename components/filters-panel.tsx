"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

interface FiltersPanelProps {
  selectedRoadType: string | null
  setSelectedRoadType: (type: string | null) => void
}

export function FiltersPanel({ selectedRoadType, setSelectedRoadType }: FiltersPanelProps) {
  const handleRoadTypeChange = (value: string) => {
    setSelectedRoadType(value)
  }

  const clearFilters = () => {
    setSelectedRoadType(null)
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="p-4 flex-shrink-0">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <p className="text-sm text-muted-foreground mb-4">Filter road defects by road type and other criteria</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">Road Type</h3>
          <RadioGroup value={selectedRoadType || ""} onValueChange={handleRoadTypeChange} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="concrete" id="concrete" />
              <Label htmlFor="concrete">Concrete</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="asphalt" id="asphalt" />
              <Label htmlFor="asphalt">Asphalt</Label>
            </div>
          </RadioGroup>
        </div>

        <Button variant="outline" size="sm" onClick={clearFilters} disabled={!selectedRoadType} className="w-full">
          Clear Filters
        </Button>
        </div>
      </div>
    </div>
  )
}
