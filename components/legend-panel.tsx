"use client"

export function LegendPanel() {
  return (
    <div className="h-full overflow-y-auto flex flex-col">
      <div className="p-4 flex-shrink-0">
      <h2 className="text-lg font-semibold mb-4">Legend</h2>
      <p className="text-sm text-white/80 mb-4">Understand the severity levels and map symbols</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Severity Levels</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500"></div>
              <span className="text-sm">Severe (&ge;50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
              <span className="text-sm">Moderate (30-49%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm">Low (&lt;30%)</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-2">Defect Types</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white"></div>
              <span className="text-sm">Linear Crack</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white"></div>
              <span className="text-sm">Alligator Crack</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-white"></div>
              <span className="text-sm">Pothole</span>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
