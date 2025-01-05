"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function IntegrationSettings() {
  const [googleCalendar, setGoogleCalendar] = useState(false)
  const [slack, setSlack] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [mailchimp, setMailchimp] = useState(false)

  const handleSave = () => {
    // Here you would typically save the settings to your backend
    console.log("Saving integration settings:", {
      googleCalendar,
      slack,
      zoom,
      mailchimp
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="google-calendar">Google Calendar</Label>
        <Switch
          id="google-calendar"
          checked={googleCalendar}
          onCheckedChange={setGoogleCalendar}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="slack">Slack</Label>
        <Switch
          id="slack"
          checked={slack}
          onCheckedChange={setSlack}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="zoom">Zoom</Label>
        <Switch
          id="zoom"
          checked={zoom}
          onCheckedChange={setZoom}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="mailchimp">Mailchimp</Label>
        <Switch
          id="mailchimp"
          checked={mailchimp}
          onCheckedChange={setMailchimp}
        />
      </div>
      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  )
}

