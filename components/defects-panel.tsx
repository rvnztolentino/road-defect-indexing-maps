"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { RecentDefects } from "@/components/recent-defects"
import type { DefectDetection } from "@/lib/types"

interface DefectsPanelProps {
  selectedDefectType: string | null
  setSelectedDefectType: (type: string | null) => void
}

interface DefectTypeInfo {
  id: string
  name: string
  description: string
  image: string
}

export function DefectsPanel({ selectedDefectType, setSelectedDefectType }: DefectsPanelProps) {
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState<"types" | "recent">("types")
  const [defectTypes, setDefectTypes] = useState<DefectTypeInfo[]>([
    {
      id: "linear-crack",
      name: "Linear Crack",
      description: "Straight line cracks in the road surface",
      image: "/images/linear-crack.png",
    },
    {
      id: "alligator-crack",
      name: "Alligator Crack",
      description: "Interconnected cracks forming a pattern similar to alligator skin",
      image: "/images/alligator-crack.png",
    },
    {
      id: "pothole",
      name: "Pothole",
      description: "Bowl-shaped holes of various sizes in the road surface",
      image: "/images/pothole.png",
    }
  ])

  // Initialize with predefined types
  useEffect(() => {
    const predefinedTypes = [
      {
        id: "linear-crack",
        name: "Linear Crack",
        description: "Straight line cracks in the road surface",
        image: "/images/linear-crack.png",
      },
      {
        id: "alligator-crack",
        name: "Alligator Crack",
        description: "Interconnected cracks forming a pattern similar to alligator skin",
        image: "/images/alligator-crack.png",
      },
      {
        id: "pothole",
        name: "Pothole",
        description: "Bowl-shaped holes of various sizes in the road surface",
        image: "/images/pothole.png",
      }
    ]

    setDefectTypes(predefinedTypes)
  }, [])

  const toggleDefect = (defectId: string) => {
    if (expandedDefect === defectId) {
      setExpandedDefect(null)
    } else {
      setExpandedDefect(defectId)
    }
  }

  const selectDefectType = (defectId: string) => {
    setSelectedDefectType(selectedDefectType === defectId ? null : defectId)
  }

  const handleSelectDefect = (defect: DefectDetection) => {
    // Select the dominant defect type
    setSelectedDefectType(defect.metadata.DominantDefectType)
  }

  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="p-4 flex-shrink-0">
      <h2 className="text-lg font-semibold mb-4">Road Defects</h2>

      <div className="flex border-b mb-4">
        <button
          className={cn(
            "pb-2 text-sm font-medium flex-1",
            selectedTab === "types"
              ? "border-b-2 border-primary text-primary"
              : "text-white/80 hover:text-white",
          )}
          onClick={() => setSelectedTab("types")}
        >
          Defect Types
        </button>
        <button
          className={cn(
            "pb-2 text-sm font-medium flex-1",
            selectedTab === "recent"
              ? "border-b-2 border-primary text-primary"
              : "text-white/80 hover:text-white",
          )}
          onClick={() => setSelectedTab("recent")}
        >
          Recent Defects
        </button>
        </div>
      </div>

      {selectedTab === "types" ? (
        <div className="space-y-3 px-4">
          <p className="text-sm text-white/80 mb-4">
              Select a defect type to view details and filter the map
          </p>

          {defectTypes.map((defect) => (
            <Card
              key={defect.id}
              className={cn(
                "overflow-hidden transition-all",
                selectedDefectType === defect.id && "ring-2 ring-primary",
              )}
            >
              <div
                className="flex items-center justify-between px-4 cursor-pointer"
                onClick={() => toggleDefect(defect.id)}
              >
                <h3 className="font-medium">{defect.name}</h3>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expandedDefect === defect.id && "transform rotate-180",
                  )}
                />
              </div>

              <div
                className={cn(
                  "grid grid-rows-[0fr] transition-all",
                  expandedDefect === defect.id && "grid-rows-[1fr]",
                )}
              >
                <div className="overflow-hidden">
                  <CardContent className="p-3 pt-0">
                    <div className="relative h-48 mb-3 border rounded overflow-hidden">
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
                        <span className="text-white font-semibold px-2 py-1 bg-red-500 rounded">{defect.name}</span>
                      </div>
                      <Image
                        src={defect.image}
                        alt={defect.name}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/images/defect-placeholder.png";
                        }}
                      />
                    </div>
                    <p className="text-sm text-white/80 mb-3">{defect.description}</p>
                    <Button
                      variant={selectedDefectType === defect.id ? "default" : "outline"}
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        selectDefectType(defect.id)
                      }}
                    >
                      {selectedDefectType === defect.id ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <RecentDefects onSelectDefect={handleSelectDefect} />
      )}
    </div>
  )
}
