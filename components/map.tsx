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

  // Fetch defects from API
  const fetchDefects = async () => {
    try {
      const response = await fetch("/api/defects")
      const data = await response.json()

      if (data.detections) {
        setDefects(data.detections)
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

      // Set up refresh interval (every 20 seconds)
      refreshIntervalRef.current = setInterval(fetchDefects, 20000)
    })

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update map when defects or filters change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || defects.length === 0) return

    // Remove existing markers
    const existingMarkers = document.querySelectorAll(".mapboxgl-marker")
    existingMarkers.forEach((marker) => marker.remove())

    // Filter defects based on selected filters
    const filteredDefects = defects.filter((defect) => {
      // Filter by defect type if selected
      if (selectedDefectType && !Object.keys(defect.metadata.defect_counts).includes(selectedDefectType)) {
        return false
      }

      // Filter by road type if implemented in your metadata
      // This would require road type to be part of your metadata

      return true
    })

    // Add markers for each defect
    filteredDefects.forEach((defect) => {
      if (!map.current) return

      // Create custom marker element
      const markerEl = document.createElement("div")
      markerEl.className = "defect-marker"

      // Determine marker color based on highest severity defect
      let markerColor = "#3b82f6" // Default blue

      // Check if there are any severe defects (you can define your own severity logic)
      const defectTypes = Object.keys(defect.metadata.defect_counts)
      const totalDefects = Object.values(defect.metadata.defect_counts).reduce((sum, count) => sum + count, 0)

      if (totalDefects > 5) {
        markerColor = "#ef4444" // Red for severe
      } else if (totalDefects > 2) {
        markerColor = "#eab308" // Yellow for moderate
      } else {
        markerColor = "#22c55e" // Green for minor
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
      popupContent.className = "p-2"

      // Add image if available
      if (defect.imageUrl) {
        const imageContainer = document.createElement("div")
        imageContainer.className = "mb-2"

        const image = document.createElement("img")
        image.src = defect.imageUrl
        image.className = "w-full h-auto rounded"
        image.style.maxWidth = "200px"
        image.style.maxHeight = "150px"
        image.alt = "Defect image"

        imageContainer.appendChild(image)
        popupContent.appendChild(imageContainer)
      }

      // Add defect information
      const title = document.createElement("h3")
      title.className = "font-semibold text-sm mb-1"
      title.textContent = `Defect ID: ${defect.id}`

      const timestamp = document.createElement("p")
      timestamp.className = "text-xs mb-1"
      timestamp.innerHTML = `<span class="font-medium">Timestamp:</span> ${formatTimestamp(defect.metadata.timestamp)}`

      const defectsList = document.createElement("p")
      defectsList.className = "text-xs"
      defectsList.innerHTML = `<span class="font-medium">Defects:</span> ${formatDefectCounts(defect.metadata.defect_counts)}`

      popupContent.appendChild(title)
      popupContent.appendChild(timestamp)
      popupContent.appendChild(defectsList)

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setDOMContent(popupContent)

      // Add marker to map
      new mapboxgl.Marker(markerEl)
        .setLngLat([defect.location[1], defect.location[0]]) // [longitude, latitude]
        .setPopup(popup)
        .addTo(map.current)
    })
  }, [defects, selectedDefectType, selectedRoadType])

  // Format timestamp from YYYYMMDD_HHMMSS to readable format
  const formatTimestamp = (timestamp: string): string => {
    if (!timestamp || timestamp === "unknown") return "Unknown"

    // Extract date and time parts
    const match = timestamp.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/)
    if (!match) return timestamp

    const [_, year, month, day, hour, minute, second] = match
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }

  // Format defect counts for display
  const formatDefectCounts = (counts: Record<string, number>): string => {
    return Object.entries(counts)
      .map(([type, count]) => `${formatDefectType(type)}: ${count}`)
      .join(", ")
  }

  // Format defect type for display
  const formatDefectType = (type: string): string => {
    switch (type) {
      case "linear-crack":
        return "Linear Crack"
      case "alligator-crack":
        return "Alligator Crack"
      case "pothole":
        return "Pothole"
      case "patch":
        return "Patch"
      default:
        return type.charAt(0).toUpperCase() + type.slice(1)
    }
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
      {lastUpdated && (
        <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-gray-800/90 px-3 py-1 rounded-md text-xs shadow-md">
          Last updated: {lastUpdated.toLocaleTimeString()}
          <button className="ml-2 text-primary hover:text-primary/80" onClick={fetchDefects} title="Refresh data">
            ↻
          </button>
        </div>
      )}
    </div>
  )
}
