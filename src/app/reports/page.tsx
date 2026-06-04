"use client"

import { useState } from 'react'
// import { Header } from '@/components/header'
import { GeneralMetrics } from '@/components/general-metrics'
import { ReportRequestForm } from '@/components/report-request-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DemographicData } from '@/components/demographic-data'

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("general")

  return (
    <div className="min-h-screen bg-background">
      {/* <Header mcHeadName="John Doe" /> */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-semibold text-foreground mb-6">Reports</h1>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="lg:hidden pl-12 flex sm:overflow-x-scroll  md:grid w-full grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="general">General Metrics</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="custom">Custom Reports</TabsTrigger>
            </TabsList>
            <TabsList className="w-full">
              <TabsTrigger value="general">General Metrics</TabsTrigger>
              <TabsTrigger value="demographics">Demographics</TabsTrigger>
              <TabsTrigger value="custom">Custom Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Church Growth Overview</CardTitle>
                  <CardDescription>Key metrics for the past 12 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <GeneralMetrics />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="demographics">
              <Card>
                <CardHeader>
                  <CardTitle>Demographic Overview</CardTitle>
                  <CardDescription>Breakdown of member demographics</CardDescription>
                </CardHeader>
                <CardContent>
                  <DemographicData />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="custom">
              <Card>
                <CardHeader>
                  <CardTitle>Custom Report Request</CardTitle>
                  <CardDescription>Select the type of report you need</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReportRequestForm />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

