"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export function CustomizationSettings() {
  const [theme, setTheme] = useState("light")
  const [fontSize, setFontSize] = useState("medium")
  const [highContrast, setHighContrast] = useState(false)
  const [compactView, setCompactView] = useState(false)

  const handleSave = () => {
    // Here you would typically save the settings to your backend
    console.log("Saving customization settings:", {
      theme,
      fontSize,
      highContrast,
      compactView
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="theme">Theme</Label>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger id="theme">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="font-size">Font Size</Label>
        <Select value={fontSize} onValueChange={setFontSize}>
          <SelectTrigger id="font-size">
            <SelectValue placeholder="Select font size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="high-contrast">High Contrast Mode</Label>
        <Switch
          id="high-contrast"
          checked={highContrast}
          onCheckedChange={setHighContrast}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="compact-view">Compact View</Label>
        <Switch
          id="compact-view"
          checked={compactView}
          onCheckedChange={setCompactView}
        />
      </div>
      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  )
}

