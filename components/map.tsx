"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Loader } from "@/components/ui/loader"
import type { DefectDetection } from "@/lib/cloud-storage"

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

interface MapComponentProps {
  selectedDefectType: string | null
  selectedRoadType: string | null
}

export default function MapComponent({ selectedDefectType, selectedRoadType }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [defects, setDefects] = useState<DefectDetection[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({})

  // Fetch defects from API
  const fetchDefects = async () => {
    try {
      // If we have a lastUpdated timestamp, only fetch newer defects
      const params = lastUpdated ? `?since=${lastUpdated.toISOString()}` : ""
      const response = await fetch(`/api/defects${params}`)
      const data = await response.json()

      if (data.detections) {
        // If we're fetching updates, append new defects to existing ones
        if (lastUpdated) {
          setDefects((prev) => {
            // Create a map of existing defects by ID for quick lookup
            const existingDefectsMap = new Map(prev.map((d) => [d.id, d]))

            // Add new defects and update existing ones
            data.detections.forEach((detection: DefectDetection) => {
              existingDefectsMap.set(detection.id, detection)
            })

            return Array.from(existingDefectsMap.values())
          })
        } else {
          // Initial load
          setDefects(data.detections)
        }

        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error("Error fetching defects:", error)
    }
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [120.9842, 14.5995], // Manila coordinates
      zoom: 12,
    })

    map.current.on("load", () => {
      setLoading(false)

      // Add navigation controls
      map.current?.addControl(new mapboxgl.NavigationControl(), "top-right")

      // Fetch initial defects
      fetchDefects()

      // Set up refresh interval (every 30 seconds)
      refreshIntervalRef.current = setInterval(fetchDefects, 30000)
    })

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }

      // Clean up markers
      Object.values(markersRef.current).forEach((marker) => marker.remove())

      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update map when defects or filters change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || defects.length === 0) return

    // Filter defects based on selected filters
    const filteredDefects = defects.filter((defect) => {
      // Filter by defect type if selected
      if (selectedDefectType && defect.metadata.DominantDefectType !== selectedDefectType) {
        return false
      }

      // Filter by road type if implemented in your metadata
      // This would require road type to be part of your metadata

      return true
    })

    // Track existing markers to remove those that are no longer needed
    const currentMarkerIds = new Set<string>()

    // Add or update markers for each defect
    filteredDefects.forEach((defect) => {
      if (!map.current) return

      currentMarkerIds.add(defect.id)

      // Check if marker already exists
      if (markersRef.current[defect.id]) {
        // Update marker position if needed
        markersRef.current[defect.id].setLngLat([defect.location[1], defect.location[0]])
        return
      }

      // Create custom marker element
      const markerEl = document.createElement("div")
      markerEl.className = "defect-marker"

      // Determine marker color based on severity level
      let markerColor
      switch (defect.metadata.SeverityLevel) {
        case "High":
          markerColor = "#ef4444" // Red for high severity
          break
        case "Moderate":
          markerColor = "#eab308" // Yellow for moderate severity
          break
        case "Low":
          markerColor = "#22c55e" // Green for low severity
          break
        default:
          markerColor = "#3b82f6" // Default blue
      }

      // Style the marker
      markerEl.style.width = "20px"
      markerEl.style.height = "20px"
      markerEl.style.borderRadius = "50%"
      markerEl.style.backgroundColor = markerColor
      markerEl.style.border = "2px solid white"
      markerEl.style.boxShadow = "0 0 0 1px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2)"

      // Create popup content
      const popupContent = document.createElement("div")
      popupContent.className = "p-3 max-w-xs"

      // Add image if available
      if (defect.imageUrl) {
        const imageContainer = document.createElement("div")
        imageContainer.className = "mb-3"

        const image = document.createElement("img")
        image.src = defect.imageUrl
        image.className = "w-full h-auto rounded"
        image.style.maxWidth = "250px"
        image.style.maxHeight = "180px"
        image.alt = "Defect image"

        imageContainer.appendChild(image)
        popupContent.appendChild(imageContainer)
      }

      // Add defect information
      const title = document.createElement("h3")
      title.className = "font-semibold text-sm mb-2"
      title.textContent = `${defect.metadata.DominantDefectType} (${defect.metadata.SeverityLevel})`

      const infoContainer = document.createElement("div")
      infoContainer.className = "space-y-1 text-xs"

      // Add timestamp
      const timestamp = document.createElement("p")
      timestamp.innerHTML = `<span class="font-medium">Detected:</span> ${formatDateTime(defect.metadata.ProcessingTimestamp)}`
      infoContainer.appendChild(timestamp)

      // Add defect counts
      const defectsList = document.createElement("p")
      defectsList.innerHTML = `<span class="font-medium">Defects:</span> ${formatDefectCounts(defect.metadata.DefectCounts)}`
      infoContainer.appendChild(defectsList)

      // Add repair probability
      const repairProb = document.createElement("p")
      repairProb.innerHTML = `<span class="font-medium">Repair Probability:</span> ${Math.round(defect.metadata.RepairProbability * 100)}%`
      infoContainer.appendChild(repairProb)

      // Add dimensions
      const dimensions = document.createElement("p")
      dimensions.innerHTML = `<span class="font-medium">Size:</span> ${defect.metadata.AverageLength.toFixed(1)} × ${defect.metadata.AverageWidth.toFixed(1)} cm`
      infoContainer.appendChild(dimensions)

      // Add area
      const area = document.createElement("p")
      area.innerHTML = `<span class="font-medium">Area:</span> ${defect.metadata.RealWorldArea.toFixed(2)} m²`
      infoContainer.appendChild(area)

      popupContent.appendChild(title)
      popupContent.appendChild(infoContainer)

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent)

      // Add marker to map
      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([defect.location[1], defect.location[0]]) // [longitude, latitude]
        .setPopup(popup)
        .addTo(map.current)

      // Store marker reference
      markersRef.current[defect.id] = marker
    })

    // Remove markers that are no longer in the filtered list
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentMarkerIds.has(id)) {
        markersRef.current[id].remove()
        delete markersRef.current[id]
      }
    })
  }, [defects, selectedDefectType, selectedRoadType])

  // Format ISO datetime to readable format
  const formatDateTime = (isoString: string): string => {
    try {
      const date = new Date(isoString)
      return date.toLocaleString()
    } catch (e) {
      return isoString
    }
  }

  // Format defect counts for display
  const formatDefectCounts = (counts: Record<string, number>): string => {
    return Object.entries(counts)
      .map(([type, count]) => `${formatDefectType(type)}: ${count}`)
      .join(", ")
  }

  // Format defect type for display
  const formatDefectType = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <Loader />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Last updated indicator */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-md text-xs shadow-md">
        {lastUpdated ? (
          <>
            Last updated: {lastUpdated.toLocaleTimeString()}
            <button className="ml-2 text-primary hover:text-primary/80" onClick={fetchDefects} title="Refresh data">
              ↻
            </button>
          </>
        ) : (
          "Loading data..."
        )}
      </div>

      {/* Defect count indicator */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-md text-xs shadow-md">
        {defects.length} defects detected
      </div>
    </div>
  )
}
