"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface ConfigStatus {
  mapboxToken: boolean
  googleProjectId: boolean
  googleCloudBucketName: boolean
  googleCloudRegion: boolean
  googleCloudFolderPath: boolean
}

export function ConfigDebug() {
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [loading, setLoading] = useState(false)

  const checkConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/config")
      const data = await response.json()
      setConfigStatus(data.configStatus)
    } catch (error) {
      console.error("Error checking config:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkConfig()
  }, [])

  const getStatusIcon = (status: boolean) => {
    return status ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Configuration Status
          <Button variant="ghost" size="sm" onClick={checkConfig} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {configStatus ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Mapbox Token</span>
              {getStatusIcon(configStatus.mapboxToken)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Google Project ID</span>
              {getStatusIcon(configStatus.googleProjectId)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Google Cloud Bucket</span>
              {getStatusIcon(configStatus.googleCloudBucketName)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Google Cloud Region</span>
              {getStatusIcon(configStatus.googleCloudRegion)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Google Cloud Folder</span>
              {getStatusIcon(configStatus.googleCloudFolderPath)}
            </div>
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            {loading ? "Checking configuration..." : "Failed to load configuration"}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
