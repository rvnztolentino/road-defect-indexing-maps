"use client"

import { useState } from "react"
import { X } from 'lucide-react'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MapPin, Filter, Info, ChevronDown } from "lucide-react"
import { DefectsPanel } from "@/components/defects-panel"
import { FiltersPanel } from "@/components/filters-panel"
import { LegendPanel } from "@/components/legend-panel"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface SidebarProps {
  selectedDefectType: string | null;
  setSelectedDefectType: (type: string | null) => void;
  selectedRoadType: string | null;
  setSelectedRoadType: (type: string | null) => void;
  isLegendOpen: boolean;
  setIsLegendOpen: (isOpen: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
}

export function Sidebar({
  selectedDefectType,
  setSelectedDefectType,
  selectedRoadType,
  setSelectedRoadType,
  isLegendOpen,
  setIsLegendOpen,
  isSidebarOpen,
  setIsSidebarOpen,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState("defects")

  // Menu labels for each tab
  const menuLabels = {
    defects: "Defects",
    filters: "Filters",
    legend: "Legend",
  }

  return (
    <div className="w-full md:w-80 bg-black text-white border-r h-full flex flex-col">
      {/* Mobile Dropdown Menu */}
      <div className="md:hidden p-2 border-b">
        <X className="top-2 right-2 cursor-pointer mb-2" onClick={() => setIsSidebarOpen(false)} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                {activeTab === "defects" && <MapPin className="h-4 w-4" />}
                {activeTab === "filters" && <Filter className="h-4 w-4" />}
                {activeTab === "legend" && <Info className="h-4 w-4" />}
                <span>{menuLabels[activeTab as keyof typeof menuLabels]}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[calc(100vw-1rem)] max-w-[300px]">
            <DropdownMenuItem onClick={() => setActiveTab("defects")} className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span>Defects</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab("filters")} className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveTab("legend")} className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span>Legend</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="hidden md:grid grid-cols-3 p-0 h-auto w-full">
          <TabsTrigger value="defects" className="flex items-center gap-1 py-3">
            <MapPin className="h-4 w-4" />
            <span>Defects</span>
          </TabsTrigger>
          <TabsTrigger value="filters" className="flex items-center gap-1 py-3">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </TabsTrigger>
          <TabsTrigger value="legend" className="flex items-center gap-1 py-3">
            <Info className="h-4 w-4" />
            <span>Legend</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="defects" className="flex-1 p-0 m-0">
          <DefectsPanel selectedDefectType={selectedDefectType} setSelectedDefectType={setSelectedDefectType} />
        </TabsContent>

        <TabsContent value="filters" className="flex-1 p-0 m-0">
          <FiltersPanel selectedRoadType={selectedRoadType} setSelectedRoadType={setSelectedRoadType} />
        </TabsContent>

        <TabsContent value="legend" className="flex-1 p-0 m-0">
          <LegendPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
