"use client"

import { useState } from "react"
import { ConfigDebug } from "@/components/config-debug"
import { SetupGuide } from "@/components/setup-guide"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export default function DebugPage() {
  const [gcsTest, setGcsTest] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testGCS = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/test-gcs")
      const data = await response.json()
      setGcsTest(data)
    } catch (error) {
      console.error("Error testing GCS:", error)
      setGcsTest({
        success: false,
        message: "Failed to test Google Cloud Storage",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Debug Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <ConfigDebug />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Google Cloud Storage Test
                <Button variant="ghost" size="sm" onClick={testGCS} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {gcsTest ? (
                <div className="space-y-3">
                  <div
                    className={`p-2 rounded ${gcsTest.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                  >
                    {gcsTest.message}
                  </div>

                  {gcsTest.environment && (
                    <div>
                      <h4 className="font-medium mb-2">Environment Variables:</h4>
                      <div className="space-y-1 text-sm">
                        <div>Project ID: {gcsTest.environment.projectId}</div>
                        <div>Bucket Name: {gcsTest.environment.bucketName}</div>
                        <div>Region: {gcsTest.environment.region}</div>
                        <div>Folder Path: {gcsTest.environment.folderPath}</div>
                      </div>
                    </div>
                  )}

                  {gcsTest.success && (
                    <div>
                      <h4 className="font-medium mb-2">Files Found: {gcsTest.fileCount}</h4>
                      {gcsTest.sampleFiles && gcsTest.sampleFiles.length > 0 && (
                        <div className="text-sm">
                          <p className="mb-1">Sample files:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {gcsTest.sampleFiles.map((file: string, index: number) => (
                              <li key={index} className="truncate">
                                {file}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {gcsTest.sampleDetection && (
                        <div className="text-sm mt-3">
                          <p className="mb-1 font-medium">Sample Detection Test:</p>
                          <div className="space-y-1">
                            <div>Metadata: ✓ Parsed successfully</div>
                            <div>Image URL: {gcsTest.sampleDetection.imageUrl}</div>
                            <div>
                              GPS Location: {gcsTest.sampleDetection.metadata?.GPSLocation?.join(", ") || "Not found"}
                            </div>
                            <div>Severity: {gcsTest.sampleDetection.metadata?.SeverityLevel || "Not found"}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {gcsTest.error && (
                    <div className="text-sm text-red-600">
                      <strong>Error:</strong> {gcsTest.error}
                    </div>
                  )}

                  {gcsTest.troubleshooting && (
                    <div className="text-sm">
                      <strong>Troubleshooting:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {gcsTest.troubleshooting.map((tip: string, index: number) => (
                          <li key={index}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground">
                  Click the refresh button to test Google Cloud Storage connection
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <SetupGuide />
        </div>
      </div>
    </div>
  )
}
