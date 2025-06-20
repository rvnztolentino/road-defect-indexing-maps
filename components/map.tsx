"use client"

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Loader } from "@/components/ui/loader"
import type { DefectDetection } from "@/lib/types"

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""

interface MapComponentProps {
  selectedDefectType: string | null
}

const MapComponent = forwardRef<{ flyToDefect: (defect: DefectDetection) => void }, MapComponentProps>(({ selectedDefectType: _selectedDefectType }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [defects, setDefects] = useState<DefectDetection[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [defectsLoaded, setDefectsLoaded] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const openPopupsRef = useRef<Set<mapboxgl.Popup>>(new Set())
  const [previewImage, setPreviewImage] = useState<{ url: string; isOpen: boolean }>({ url: "", isOpen: false })
  const [loadingClusters, setLoadingClusters] = useState(false)
  const [currentZoom, setCurrentZoom] = useState(13)
  const clickHandlerRef = useRef<((e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => void) | null>(null)
  const mouseEnterHandlerRef = useRef<(() => void) | null>(null)
  const mouseLeaveHandlerRef = useRef<(() => void) | null>(null)

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
      console.log('Fetching defects...')
      const params = lastUpdated ? `?since=${lastUpdated.toISOString()}` : ""
      const response = await fetch(`/api/defects${params}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to fetch defects')
      }

      const data = await response.json()

      console.log('Received defects data:', {
        hasDetections: !!data.detections,
        count: data.detections?.length || 0,
        firstDefect: data.detections?.[0]
      })

      if (data.detections) {
        if (lastUpdated) {
          setDefects((prev) => {
            const existingDefectsMap = new Map(prev.map((d) => [d.id, d]))
            data.detections.forEach((detection: DefectDetection) => {
              existingDefectsMap.set(detection.id, detection)
            })
            const currentIds = new Set(data.detections.map((d: DefectDetection) => d.id))
            const updatedDefects = Array.from(existingDefectsMap.values()).filter(d => currentIds.has(d.id))
            console.log('Updated defects:', {
              previousCount: prev.length,
              newCount: updatedDefects.length,
              firstDefect: updatedDefects[0]
            })
            return updatedDefects
          })
        } else {
          console.log('Setting initial defects:', {
            count: data.detections.length,
            firstDefect: data.detections[0]
          })
          setDefects(data.detections)
        }
        setLastUpdated(new Date())
        setDefectsLoaded(true)
      }
    } catch (error) {
      console.error("Error fetching defects:", error)
      // Show error state to user
      setDefectsLoaded(true) // Allow map to render even if fetch fails
    }
  }, [lastUpdated])

  // Function to close all open popups
  const closeAllPopups = () => {
    openPopupsRef.current.forEach(popup => popup.remove())
    openPopupsRef.current.clear()
  }

  // Function to fly to a defect's location and show popup
  const flyToDefect = useCallback((defect: DefectDetection) => {
    if (!map.current) return

    // Close any existing popups
    closeAllPopups()

    // Fly to the defect's location
    map.current.flyTo({
      center: [defect.location[1], defect.location[0]], // [longitude, latitude]
      zoom: 16, // Zoom level to show the defect clearly
      duration: 2000, // Animation duration in milliseconds
      essential: true // This ensures the animation is not skipped
    })

    // Wait for the fly animation to complete before showing the popup
    setTimeout(() => {
      if (!map.current) return

      // Helper functions
      const formatSeverityLevel = (severity: number): string => {
        const roundedSeverity = Math.round(severity * 100) / 100
        if (roundedSeverity >= 0.5) return "Severe"
        if (roundedSeverity >= 0.3) return "Moderate"
        return "Low"
      }

      const getSeverityColorClass = (severity: number): string => {
        const roundedSeverity = Math.round(severity * 100) / 100
        if (roundedSeverity >= 0.5) return "text-red-500"
        if (roundedSeverity >= 0.3) return "text-yellow-500"
        return "text-green-500"
      }

      const formatDateTime = (isoString: string): string => {
        try {
          const date = new Date(isoString)
          return date.toLocaleString()
        } catch (error) {
          console.error("Error formatting date:", error)
          return isoString
        }
      }

      // Create popup content
      const popupContent = document.createElement("div")
      popupContent.className = "p-3 max-w-xs text-black"

      // Add image if available
      if (defect.imageUrl) {
        const imageContainer = document.createElement("div")
        imageContainer.className = "mb-3 cursor-pointer"

        const image = document.createElement("img")
        image.className = "w-full h-auto rounded hover:opacity-90 transition-opacity"
        image.style.maxWidth = "250px"
        image.style.maxHeight = "180px"
        image.alt = "Defect image"
        image.crossOrigin = "anonymous"
        image.loading = "lazy"
        image.src = defect.imageUrl

        // Add click handler for image preview
        image.onclick = (e: MouseEvent) => {
          e.stopPropagation()
          setPreviewImage({ url: defect.imageUrl, isOpen: true })
        }

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
      severitySpan.textContent = `${severityText} (${(defect.metadata.SeverityLevel * 100).toFixed(1)}%)`
      title.appendChild(severitySpan)

      const infoContainer = document.createElement("div")
      infoContainer.className = "space-y-1 text-xs text-black"

      // Add timestamp
      const timestamp = document.createElement("p")
      timestamp.innerHTML = `<span class="font-medium">Detected:</span> ${formatDateTime(defect.metadata.ProcessingTimestamp)}`
      infoContainer.appendChild(timestamp)

      // Add severity level with percentage
      const severityInfo = document.createElement("p")
      severityInfo.innerHTML = `<span class="font-medium">Severity:</span> ${severityText} (${(defect.metadata.SeverityLevel * 100).toFixed(1)}%)`
      infoContainer.appendChild(severityInfo)

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

      // Add popup to map
      popup.setLngLat([defect.location[1], defect.location[0]]).addTo(map.current)
      openPopupsRef.current.add(popup)
    }, 2000) // Wait for fly animation to complete
  }, [formatDefectCounts])

  // Expose the flyToDefect function through a ref
  useImperativeHandle(ref, () => ({
    flyToDefect
  }))

  // Initialize map with clustering
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    console.log('Initializing map...')
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [121.0785, 14.5736],
      zoom: 13,
    })

    map.current.on('click', () => {
      closeAllPopups()
    })

    map.current.on("load", async () => {
      console.log('Map loaded, initializing...')
      setLoading(false)

      // Add navigation controls
      map.current?.addControl(new mapboxgl.NavigationControl(), "top-right")

      // Add clustering source and layers
      if (map.current) {
        console.log('Adding defects source...')
        map.current.addSource('defects', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          },
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
          clusterProperties: {
            sum_severity: ['+', ['get', 'severity']]
          }
        })

        // Add cluster layer
        map.current.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'defects',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#51bbd6',  // Blue for small clusters
              100, '#f1f075',  // Yellow for medium clusters
              750, '#f28cb1'  // Pink for large clusters
            ],
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              20,
              100, 30,
              750, 40
            ]
          }
        })

        // Add cluster count layer
        map.current.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'defects',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12
          }
        })

        // Add unclustered point layer
        map.current.addLayer({
          id: 'unclustered-point',
          type: 'circle',
          source: 'defects',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': [
              'case',
              ['>=', ['get', 'severity'], 0.5], '#ef4444',
              ['>=', ['get', 'severity'], 0.3], '#eab308',
              '#22c55e'
            ],
            'circle-radius': 8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
          }
        })

        // Add click handler for clusters
        map.current.on('click', 'clusters', (e) => {
          const features = e.features
          if (!features || features.length === 0) return
          
          const clusterId = features[0].properties?.cluster_id
          const source = map.current?.getSource('defects') as mapboxgl.GeoJSONSource
          
          if (!source || !map.current) return

          source.getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
              if (err || !zoom) return

              map.current?.easeTo({
                center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
                zoom: zoom,
                duration: 500
              })
            }
          )
        })

        // Change cursor on cluster hover
        map.current.on('mouseenter', 'clusters', () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = 'pointer'
          }
        })

        map.current.on('mouseleave', 'clusters', () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = ''
          }
        })

        // Fetch initial defects
        console.log('Fetching initial defects...')
        try {
          const response = await fetch('/api/defects')
          const data = await response.json()
          console.log('Received initial defects:', {
            hasDetections: !!data.detections,
            count: data.detections?.length || 0,
            firstDetection: data.detections?.[0] ? {
              id: data.detections[0].id,
              location: data.detections[0].location,
              type: data.detections[0].metadata.DominantDefectType
            } : null
          })
          
          if (data.detections) {
            setDefects(data.detections)
            setLastUpdated(new Date())
            setDefectsLoaded(true)
          }
        } catch (error) {
          console.error('Error fetching initial defects:', error)
        }

        // Set up refresh interval
        refreshIntervalRef.current = setInterval(fetchDefects, 60000)
      }
    })

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update defects source when defects change
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || defects.length === 0) {
      console.log('Map not ready or no defects:', {
        hasMap: !!map.current,
        isStyleLoaded: map.current?.isStyleLoaded(),
        defectsCount: defects.length
      })
      return
    }

    console.log('Updating defects source with:', {
      count: defects.length,
      firstDefect: defects[0] ? {
        id: defects[0].id,
        location: defects[0].location,
        type: defects[0].metadata.DominantDefectType
      } : null
    })

    const source = map.current.getSource('defects') as mapboxgl.GeoJSONSource
    if (!source) {
      console.error('Defects source not found')
      return
    }

    // Filter defects based on selected type
    const filteredDefects = _selectedDefectType
      ? defects.filter(defect => 
          defect.metadata.DominantDefectType.toLowerCase() === _selectedDefectType.toLowerCase()
        )
      : defects

    const features = filteredDefects.map(defect => {
      const feature = {
        type: 'Feature' as const,
        properties: {
          id: defect.id,
          severity: defect.metadata.SeverityLevel,
          type: defect.metadata.DominantDefectType
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [defect.location[1], defect.location[0]]
        }
      }
      return feature
    })

    console.log('Setting source data with features:', {
      count: features.length,
      firstFeature: features[0],
      selectedType: _selectedDefectType
    })

    source.setData({
      type: 'FeatureCollection',
      features
    })

    // Remove existing click handlers
    if (map.current) {
      if (clickHandlerRef.current) map.current.off('click', 'unclustered-point', clickHandlerRef.current)
      if (mouseEnterHandlerRef.current) map.current.off('mouseenter', 'unclustered-point', mouseEnterHandlerRef.current)
      if (mouseLeaveHandlerRef.current) map.current.off('mouseleave', 'unclustered-point', mouseLeaveHandlerRef.current)
    }

    // Add click handlers for individual points
    clickHandlerRef.current = (e) => {
      if (!e.features?.[0]) return
      const coordinates = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number]
      const properties = e.features[0].properties
      const defect = defects.find(d => d.id === properties?.id)
      
      if (!defect) {
        console.log('No defect found for ID:', properties?.id)
        return
      }

      console.log('Found defect:', {
        id: defect.id,
        type: defect.metadata.DominantDefectType,
        severity: defect.metadata.SeverityLevel
      })

      // Close any existing popups
      closeAllPopups()

      // Helper functions
      const formatSeverityLevel = (severity: number): string => {
        const roundedSeverity = Math.round(severity * 100) / 100
        if (roundedSeverity >= 0.5) return "Severe"
        if (roundedSeverity >= 0.3) return "Moderate"
        return "Low"
      }

      const getSeverityColorClass = (severity: number): string => {
        const roundedSeverity = Math.round(severity * 100) / 100
        if (roundedSeverity >= 0.5) return "text-red-500"
        if (roundedSeverity >= 0.3) return "text-yellow-500"
        return "text-green-500"
      }

      const formatDateTime = (isoString: string): string => {
        try {
          const date = new Date(isoString)
          return date.toLocaleString()
        } catch (error) {
          console.error("Error formatting date:", error)
          return isoString
        }
      }

      // Create popup content
      const popupContent = document.createElement("div")
      popupContent.className = "p-3 max-w-xs text-black"

      // Add image if available
      if (defect.imageUrl) {
        const imageContainer = document.createElement("div")
        imageContainer.className = "mb-3 cursor-pointer"

        const image = document.createElement("img")
        image.className = "w-full h-auto rounded hover:opacity-90 transition-opacity"
        image.style.maxWidth = "250px"
        image.style.maxHeight = "180px"
        image.alt = "Defect image"
        image.crossOrigin = "anonymous"
        image.loading = "lazy"
        image.src = defect.imageUrl

        // Add click handler for image preview
        image.onclick = (e: MouseEvent) => {
          e.stopPropagation()
          setPreviewImage({ url: defect.imageUrl, isOpen: true })
        }

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
      severitySpan.textContent = `${severityText} (${(defect.metadata.SeverityLevel * 100).toFixed(1)}%)`
      title.appendChild(severitySpan)

      const infoContainer = document.createElement("div")
      infoContainer.className = "space-y-1 text-xs text-black"

      // Add timestamp
      const timestamp = document.createElement("p")
      timestamp.innerHTML = `<span class="font-medium">Detected:</span> ${formatDateTime(defect.metadata.ProcessingTimestamp)}`
      infoContainer.appendChild(timestamp)

      // Add severity level with percentage
      const severityInfo = document.createElement("p")
      severityInfo.innerHTML = `<span class="font-medium">Severity:</span> ${severityText} (${(defect.metadata.SeverityLevel * 100).toFixed(1)}%)`
      infoContainer.appendChild(severityInfo)

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

      // Add popup to map
      popup.setLngLat(coordinates).addTo(map.current!)
      openPopupsRef.current.add(popup)
    }

    mouseEnterHandlerRef.current = () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer'
      }
    }

    mouseLeaveHandlerRef.current = () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = ''
      }
    }

    map.current.on('click', 'unclustered-point', clickHandlerRef.current)
    map.current.on('mouseenter', 'unclustered-point', mouseEnterHandlerRef.current)
    map.current.on('mouseleave', 'unclustered-point', mouseLeaveHandlerRef.current)

    // Handle zoom changes
    map.current.on('zoom', () => {
      const zoom = map.current?.getZoom() || 13
      setCurrentZoom(zoom)
      if (zoom < 14) {
        setLoadingClusters(false)
      }
    })
  }, [defects, formatDefectCounts, _selectedDefectType])

  // Show loading state when zooming in
  useEffect(() => {
    if (currentZoom >= 14) {
      setLoadingClusters(true)
      const timer = setTimeout(() => {
        setLoadingClusters(false)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [currentZoom])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
          <Loader />
        </div>
      )}
      {!defectsLoaded && !loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white/90 px-6 py-4 rounded-lg shadow-lg flex flex-col items-center gap-3">
            <Loader />
            <p className="text-sm text-gray-600">Loading road defects...</p>
          </div>
        </div>
      )}
      {loadingClusters && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-white/90 px-6 py-4 rounded-lg shadow-lg flex flex-col items-center gap-3">
            <Loader />
            <p className="text-sm text-gray-600">Loading defects in this area...</p>
          </div>
        </div>
      )}
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
})

MapComponent.displayName = "MapComponent"

export default MapComponent