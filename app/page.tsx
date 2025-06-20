"use client"

import { useState, useRef } from "react"
import dynamic from "next/dynamic"
import { Loader } from "@/components/ui/loader"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import type { DefectDetection } from "@/lib/types"

// Dynamically import the Map component to avoid SSR issues with Mapbox
const MapComponent = dynamic(() => import("@/components/map"), {
  loading: () => <Loader />,
  ssr: false,
})

export default function Home() {
  const [selectedDefectType, setSelectedDefectType] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const mapRef = useRef<{ flyToDefect: (defect: DefectDetection) => void }>(null)

  const handleSelectDefect = (defect: DefectDetection) => {
    // First fly to the defect's location
    mapRef.current?.flyToDefect(defect)
    
    // Then select the defect type
    setSelectedDefectType(defect.metadata.DominantDefectType)
  }

  return (
    <div className="flex flex-col h-screen">
      <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className="flex flex-col md:flex-row flex-1 h-full overflow-hidden">
        {/* Mobile: Full width sidebar that slides in/out */}
        <div
          className={`absolute inset-0 z-20 md:relative md:z-auto transition-transform duration-300 transform ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} md:block`}
        >
          <Sidebar
            selectedDefectType={selectedDefectType}
            setSelectedDefectType={setSelectedDefectType}
            setIsSidebarOpen={setIsSidebarOpen}
            onSelectDefect={handleSelectDefect}
          />
          {/* Close overlay for mobile */}
          {isSidebarOpen && (
            <div className="md:hidden fixed inset-0 bg-black/20 z-[-1]" onClick={() => setIsSidebarOpen(false)} />
          )}
        </div>
        <main className="flex-1 relative">
          <MapComponent ref={mapRef} selectedDefectType={selectedDefectType} />
        </main>
      </div>
    </div>
  )
}
