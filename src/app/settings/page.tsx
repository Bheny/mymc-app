"use client"

import { useState } from 'react'
// import { Header } from '@/components/header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GeneralSettings } from '@/components/settings/general-settings'
import { NotificationSettings } from '@/components/settings/notification-settings'
import { PrivacySecuritySettings } from '@/components/settings/privacy-security-settings'
import { CustomizationSettings } from '@/components/settings/customization-settings'
import { IntegrationSettings } from '@/components/settings/integration-settings'
import { DataManagementSettings } from '@/components/settings/data-management-settings'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general")

  return (
    <div className="min-h-screen bg-background">
      {/* <Header mcHeadName="John Doe" /> */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-semibold text-foreground mb-6">Settings</h1>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy & Security</TabsTrigger>
              <TabsTrigger value="customization">Customization</TabsTrigger>
              <TabsTrigger value="integrations">Integrations</TabsTrigger>
              <TabsTrigger value="data">Data Management</TabsTrigger>
            </TabsList>
            <br />
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Manage your account and MC settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <GeneralSettings />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Preferences</CardTitle>
                  <CardDescription>Customize how you receive notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  <NotificationSettings />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy and Security</CardTitle>
                  <CardDescription>Manage your privacy and security settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <PrivacySecuritySettings />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="customization">
              <Card>
                <CardHeader>
                  <CardTitle>Customization</CardTitle>
                  <CardDescription>Personalize your MyMC experience</CardDescription>
                </CardHeader>
                <CardContent>
                  <CustomizationSettings />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="integrations">
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Connect MyMC with other services</CardDescription>
                </CardHeader>
                <CardContent>
                  <IntegrationSettings />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="data">
              <Card>
                <CardHeader>
                  <CardTitle>Data Management</CardTitle>
                  <CardDescription>Manage your data and exports</CardDescription>
                </CardHeader>
                <CardContent>
                  <DataManagementSettings />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

