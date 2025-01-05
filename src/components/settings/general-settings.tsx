"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function GeneralSettings() {
  const [mcName, setMcName] = useState("Example MC")
  const [mcDescription, setMcDescription] = useState("A brief description of our MC")
  const [language, setLanguage] = useState("en")
  const [timezone, setTimezone] = useState("UTC")

  const handleSave = () => {
    // Here you would typically save the settings to your backend
    console.log("Saving general settings:", { mcName, mcDescription, language, timezone })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="mc-name">MC Name</Label>
        <Input
          id="mc-name"
          value={mcName}
          onChange={(e) => setMcName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mc-description">MC Description</Label>
        <Textarea
          id="mc-description"
          value={mcDescription}
          onChange={(e) => setMcDescription(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="language">Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger id="language">
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="timezone">Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="timezone">
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UTC">UTC</SelectItem>
            <SelectItem value="America/New_York">Eastern Time</SelectItem>
            <SelectItem value="America/Chicago">Central Time</SelectItem>
            <SelectItem value="America/Denver">Mountain Time</SelectItem>
            <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  )
}

