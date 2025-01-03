"use client"

import { Card } from "@/components/ui/card"
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts'

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

export function AttendanceChart() {
  return (
    <Card className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="month" />
          <PolarRadiusAxis angle={30} domain={[0, 100]} />
          <Radar name="Attendance" dataKey="attendance" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </Card>
  )
}

