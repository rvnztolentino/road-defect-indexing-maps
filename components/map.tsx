"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Loader } from "@/components/ui/loader"
import type { DefectDetection } from "@/lib/types"

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

interface MapComponentProps {
  selectedDefectType: string | null
}

export default function MapComponent({ selectedDefectType }: MapComponentProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [defects, setDefects] = useState<DefectDetection[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [defectsLoaded, setDefectsLoaded] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const markersRef = useRef<{ [id: string]: mapboxgl.Marker }>({})
  const openPopupsRef = useRef<Set<mapboxgl.Popup>>(new Set())
  const [previewImage, setPreviewImage] = useState<{ url: string; isOpen: boolean }>({ url: "", isOpen: false })

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

  // Fetch defects from API
  const fetchDefects = useCallback(async () => {
    try {
      // If we have a lastUpdated timestamp, only fetch newer defects
      const params = lastUpdated ? `?since=${lastUpdated.toISOString()}` : ""
      const response = await fetch(`/api/defects${params}`)
      const data = await response.json()

      if (data.detections) {
        // If we're fetching updates, update the defects list
        if (lastUpdated) {
          setDefects((prev) => {
            // Create a map of existing defects by ID for quick lookup
            const existingDefectsMap = new Map(prev.map((d) => [d.id, d]))

            // Add new defects and update existing ones
            data.detections.forEach((detection: DefectDetection) => {
              existingDefectsMap.set(detection.id, detection)
            })

            // Remove defects that are no longer in the cloud
            const currentIds = new Set(data.detections.map((d: DefectDetection) => d.id))
            const updatedDefects = Array.from(existingDefectsMap.values()).filter(d => currentIds.has(d.id))

            return updatedDefects
          })
        } else {
          // Initial load
          setDefects(data.detections)
        }

        setLastUpdated(new Date())
        setDefectsLoaded(true)
      }
    } catch (error) {
      console.error("Error fetching defects:", error)
    }
  }, [lastUpdated])

  // Function to close all open popups
  const closeAllPopups = () => {
    openPopupsRef.current.forEach(popup => popup.remove())
    openPopupsRef.current.clear()
  }

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [121.0785, 14.5736], // Pasig coordinates
      zoom: 13,
    })

    // Add click handler to close popups when clicking on the map
    map.current.on('click', () => {
      closeAllPopups()
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
      const currentMarkers = markersRef.current
      Object.values(currentMarkers).forEach((marker) => marker.remove())

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
      if (selectedDefectType) {
        // Only show defects where the selected type is the dominant type
        return defect.metadata.DominantDefectType.toLowerCase() === selectedDefectType.toLowerCase();
      }

      return true;
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
      const severityValue = defect.metadata.SeverityLevel
      
      if (severityValue >= 0.7) {
        markerColor = "#f0b101" // Red for severe (0.7-1.0)
      } else if (severityValue >= 0.3) {
        markerColor = "#f97316" // Orange for moderate (0.3-0.69)
      } else {
        markerColor = "#22c55e" // Green for low severity (0-0.29)
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
      popupContent.className = "p-3 max-w-xs text-black"

      // Add image if available
      if (defect.imageUrl) {
        console.log("Attempting to load image:", {
          url: defect.imageUrl,
          defectId: defect.id,
          timestamp: new Date().toISOString()
        });

        const imageContainer = document.createElement("div")
        imageContainer.className = "mb-3 cursor-pointer"

        const image = document.createElement("img")
        
        // Add error handling before setting src
        const handleImageError = function(this: GlobalEventHandlers, e: string | Event) {
          console.error("Image failed to load:", {
            url: defect.imageUrl,
            defectId: defect.id,
            error: e,
            status: (this as HTMLImageElement).naturalWidth === 0 ? "Failed to load" : "Loaded but invalid",
            timestamp: new Date().toISOString(),
            headers: {
              'Access-Control-Allow-Origin': (this as HTMLImageElement).getAttribute('crossorigin') ? 'anonymous' : 'none'
            }
          });
          
          // Try to fetch the image directly to check if it's accessible
          fetch(defect.imageUrl)
            .then(response => {
              console.log("Direct fetch response:", {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
              });
            })
            .catch(error => {
              console.error("Direct fetch error:", error);
            });
            
          (this as HTMLImageElement).src = "/placeholder.svg?height=180&width=250"
        };

        image.onerror = handleImageError;
        image.className = "w-full h-auto rounded hover:opacity-90 transition-opacity"
        image.style.maxWidth = "250px"
        image.style.maxHeight = "180px"
        image.alt = "Defect image"
        image.crossOrigin = "anonymous"
        image.loading = "lazy"
        
        // Add click handler for image preview
        image.onclick = (e) => {
          e.stopPropagation()
          setPreviewImage({ url: defect.imageUrl, isOpen: true })
        }
        
        // Add load event handler
        image.onload = function(this: GlobalEventHandlers) {
          const img = this as HTMLImageElement;
          console.log("Image loaded successfully:", {
            url: defect.imageUrl,
            defectId: defect.id,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight
          });
        };

        // Set src after all handlers are attached
        image.src = defect.imageUrl

        imageContainer.appendChild(image)
        popupContent.appendChild(imageContainer)
      }

      // Add defect information
      const title = document.createElement("h3")
      title.className = "font-semibold text-sm mb-2 text-black flex items-center gap-2"
      title.textContent = `${defect.metadata.DominantDefectType}`

      const severitySpan = document.createElement("span")
      const severityText = formatSeverityLevel(defect.metadata.SeverityLevel)
      const severityColor = getSeverityColorClass(defect.metadata.SeverityLevel)
      severitySpan.className = `px-2 py-0.5 rounded text-xs font-medium ${severityColor} bg-opacity-10`
      severitySpan.style.backgroundColor = severityColor === "text-red-500" ? "#fee2e2" : 
                                        severityColor === "text-yellow-500" ? "#fef3c7" : 
                                        "#dcfce7"
      severitySpan.textContent = severityText
      title.appendChild(severitySpan)

      const infoContainer = document.createElement("div")
      infoContainer.className = "space-y-1 text-xs text-black"

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
      repairProb.innerHTML = `<span class="font-medium">Repair Probability:</span> ${defect.metadata.RepairProbability === 1 ? "Yes" : "No"}`
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
      const popup = new mapboxgl.Popup({ 
        offset: 25,
        closeButton: false,
        closeOnClick: false
      }).setDOMContent(popupContent)

      // Add marker to map
      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([defect.location[1], defect.location[0]]) // [longitude, latitude]
        .addTo(map.current)

      // Handle click/tap events for both mobile and desktop
      markerEl.addEventListener('click', (e) => {
        e.stopPropagation() // Prevent the map click event from firing
        
        if (popup.isOpen()) {
          // If popup is already open, close it
          popup.remove()
          openPopupsRef.current.delete(popup)
        } else {
          // Close all other popups first
          closeAllPopups()
          
          // Open this popup
          popup.setLngLat([defect.location[1], defect.location[0]])
          popup.addTo(map.current!)
          openPopupsRef.current.add(popup)
        }
      })

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
  }, [defects, selectedDefectType, formatDefectCounts])

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
    if (severity >= 0.7) {
      return "text-red-500"
    } else if (severity >= 0.3) {
      return "text-yellow-500"
    } else {
      return "text-green-500"
    }
  }

  // Format severity level for display
  const formatSeverityLevel = (severity: number): string => {
    if (severity >= 0.7) {
      return "Severe"
    } else if (severity >= 0.3) {
      return "Moderate"
    } else {
      return "Low"
    }
  }

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader />
        </div>
      )}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading defects popup */}
      {!defectsLoaded && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white/90 px-6 py-4 rounded-lg shadow-lg flex flex-col items-center gap-3">
            <Loader />
            <p className="text-sm text-gray-600">Loading road defects...</p>
          </div>
        </div>
      )}

      {/* Image preview modal */}
      {previewImage.isOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage({ url: "", isOpen: false })}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImage.url} 
              alt="Defect preview" 
              className="w-full h-auto rounded-lg shadow-xl"
            />
            <button 
              className="absolute top-4 right-4 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg transition-colors"
              onClick={() => setPreviewImage({ url: "", isOpen: false })}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Last updated indicator */}
      <div className="absolute bottom-6 right-4 text-black bg-white/90 px-3 py-1 rounded-md text-xs shadow-md">
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
      <div className="absolute top-4 left-4 text-black bg-white/90 px-3 py-1 rounded-md text-xs shadow-md">
        {defects.length} defects detected
      </div>
    </div>
  )
}
