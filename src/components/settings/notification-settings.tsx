"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { CheckedState } from "@radix-ui/react-checkbox"

export function NotificationSettings() {
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [smsNotifications, setSmsNotifications] = useState(false)
  const [eventReminders, setEventReminders] = useState(true)
  const [attendanceReminders, setAttendanceReminders] = useState(true)
  const [newMemberAlerts, setNewMemberAlerts] = useState(true)

  const handleCheckedChange = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    return (checked: CheckedState) => {
      setter(checked === true)
    }
  }

  const handleSave = () => {
    // Here you would typically save the settings to your backend
    console.log("Saving notification settings:", {
      emailNotifications,
      pushNotifications,
      smsNotifications,
      eventReminders,
      attendanceReminders,
      newMemberAlerts
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="email-notifications"
          checked={emailNotifications}
          onCheckedChange={handleCheckedChange(setEmailNotifications)}
        />
        <Label htmlFor="email-notifications">Email Notifications</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="push-notifications"
          checked={pushNotifications}
          onCheckedChange={handleCheckedChange(setPushNotifications)}
        />
        <Label htmlFor="push-notifications">Push Notifications</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="sms-notifications"
          checked={smsNotifications}
          onCheckedChange={handleCheckedChange(setSmsNotifications)}
        />
        <Label htmlFor="sms-notifications">SMS Notifications</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="event-reminders"
          checked={eventReminders}
          onCheckedChange={handleCheckedChange(setEventReminders)}
        />
        <Label htmlFor="event-reminders">Event Reminders</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="attendance-reminders"
          checked={attendanceReminders}
          onCheckedChange={handleCheckedChange(setAttendanceReminders)}
        />
        <Label htmlFor="attendance-reminders">Attendance Reminders</Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="new-member-alerts"
          checked={newMemberAlerts}
          onCheckedChange={handleCheckedChange(setNewMemberAlerts)}
        />
        <Label htmlFor="new-member-alerts">New Member Alerts</Label>
      </div>
      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  )
}

