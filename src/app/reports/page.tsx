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
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto pb-20 lg:pb-8">
      <h1 className="text-[22px] sm:text-3xl font-semibold text-foreground mb-5 sm:mb-6">Reports</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* One tab row for every width; scrolls sideways rather than squeezing the labels */}
        <div className="scroll-x -mx-4 px-4 sm:mx-0 sm:px-0 mb-2">
          <TabsList className="w-max sm:w-full">
            <TabsTrigger value="general">General Metrics</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
            <TabsTrigger value="custom">Custom Reports</TabsTrigger>
          </TabsList>
        </div>
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
  )
}
