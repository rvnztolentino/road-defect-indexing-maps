"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function SetupGuide() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exampleCredentials = `{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
}`

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Google Cloud Credentials Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You need to add your Google Cloud service account credentials as an environment variable to use Google
              Cloud Storage.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <h4 className="font-medium">Setup Steps:</h4>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>1. Create a Service Account in Google Cloud Console</strong>
                  <p className="text-muted-foreground">Go to IAM & Admin → Service Accounts → Create Service Account</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>2. Grant Storage Permissions</strong>
                  <p className="text-muted-foreground">
                    Assign the "Storage Object Admin" role to your service account
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>3. Download the JSON Key File</strong>
                  <p className="text-muted-foreground">Create and download a JSON key for your service account</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>4. Add Credentials File</strong>
                  <p className="text-muted-foreground mb-2">
                    Place your credentials.json file in the config folder of your project
                  </p>

                  <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono relative">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium">Example credentials.json format:</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(exampleCredentials)}
                        className="h-6 px-2"
                      >
                        <Copy className="h-3 w-3" />
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                    <pre className="whitespace-pre-wrap break-all">{exampleCredentials}</pre>
                  </div>

                  <Alert className="mt-2">
                    <AlertDescription className="text-xs">
                      <strong>Important:</strong> Make sure to place the credentials.json file in the config folder of your project.
                      The file should contain the entire JSON content (including curly braces) from your Google Cloud service account key.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <strong>5. Deploy and Test</strong>
                  <p className="text-muted-foreground">
                    Deploy your project and test the connection using this debug page
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Security Note:</strong> Never commit credentials.json files to your repository. Always use
              environment variables for sensitive information.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
