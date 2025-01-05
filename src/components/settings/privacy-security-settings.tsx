"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function PrivacySecuritySettings() {
  const [twoFactorAuth, setTwoFactorAuth] = useState(false)
  const [dataSharing, setDataSharing] = useState(true)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSave = () => {
    // Here you would typically save the settings to your backend
    console.log("Saving privacy and security settings:", {
      twoFactorAuth,
      dataSharing,
      passwordChanged: password !== ""
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="two-factor-auth">Two-Factor Authentication</Label>
        <Switch
          id="two-factor-auth"
          checked={twoFactorAuth}
          onCheckedChange={setTwoFactorAuth}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="data-sharing">Data Sharing with Other MCs</Label>
        <Switch
          id="data-sharing"
          checked={dataSharing}
          onCheckedChange={setDataSharing}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">New Password</Label>
        <Input
          id="new-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirm New Password</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      <Button onClick={handleSave}>Save Changes</Button>
    </div>
  )
}

