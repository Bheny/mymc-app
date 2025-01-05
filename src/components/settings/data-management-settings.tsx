"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function DataManagementSettings() {
  const [dataRetention, setDataRetention] = useState("1year")
  const [exportFormat, setExportFormat] = useState("csv")

  const handleExportData = () => {
    // Here you would typically trigger a data export process
    console.log("Exporting data in format:", exportFormat)
  }

  const handleDeleteData = () => {
    // Here you would typically trigger a data deletion process
    console.log("Initiating data deletion process")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="data-retention">Data Retention Period</Label>
        <Select value={dataRetention} onValueChange={setDataRetention}>
          <SelectTrigger id="data-retention">
            <SelectValue placeholder="Select data retention period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6months">6 Months</SelectItem>
            <SelectItem value="1year">1 Year</SelectItem>
            <SelectItem value="2years">2 Years</SelectItem>
            <SelectItem value="indefinite">Indefinite</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="export-format">Export Format</Label>
        <Select value={exportFormat} onValueChange={setExportFormat}>
          <SelectTrigger id="export-format">
            <SelectValue placeholder="Select export format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="xml">XML</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleExportData}>Export Data</Button>
      <Button variant="destructive" onClick={handleDeleteData}>Delete All Data</Button>
    </div>
  )
}

