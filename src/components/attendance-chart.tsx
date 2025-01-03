"use client"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts'

const data = [
  { month: 'Jan', attendance: 80 },
  { month: 'Feb', attendance: 90 },
  { month: 'Mar', attendance: 85 },
  { month: 'Apr', attendance: 95 },
  { month: 'May', attendance: 100 },
  { month: 'Jun', attendance: 90 },
  { month: 'Jul', attendance: 85 },
  { month: 'Aug', attendance: 80 },
  { month: 'Sep', attendance: 90 },
  { month: 'Oct', attendance: 95 },
  { month: 'Nov', attendance: 85 },
  { month: 'Dec', attendance: 80 },
]

type ChartType = 'radar' | 'line' | 'bar'

export function AttendanceChart() {
  const [chartType, setChartType] = useState<ChartType>('radar')

  const renderChart = () => {
    switch (chartType) {
      case 'radar':
        return (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="month" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar name="Attendance" dataKey="attendance" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
            <Legend />
          </RadarChart>
        )
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="attendance" stroke="#2563eb" />
          </LineChart>
        )
      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="attendance" fill="#3b82f6" />
          </BarChart>
        )
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          
          <Select value={chartType} onValueChange={(value: ChartType) => setChartType(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select chart type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="radar">Radar Chart</SelectItem>
              <SelectItem value="line">Line Chart</SelectItem>
              <SelectItem value="bar">Bar Chart</SelectItem>
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

