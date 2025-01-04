"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const data = [
  { month: 'Jan', members: 150, attendance: 120, newConverts: 5 },
  { month: 'Feb', members: 155, attendance: 125, newConverts: 7 },
  { month: 'Mar', members: 160, attendance: 130, newConverts: 6 },
  { month: 'Apr', members: 168, attendance: 135, newConverts: 8 },
  { month: 'May', members: 175, attendance: 140, newConverts: 9 },
  { month: 'Jun', members: 180, attendance: 145, newConverts: 7 },
  { month: 'Jul', members: 185, attendance: 150, newConverts: 8 },
  { month: 'Aug', members: 190, attendance: 155, newConverts: 6 },
  { month: 'Sep', members: 195, attendance: 160, newConverts: 7 },
  { month: 'Oct', members: 200, attendance: 165, newConverts: 8 },
  { month: 'Nov', members: 205, attendance: 170, newConverts: 9 },
  { month: 'Dec', members: 210, attendance: 175, newConverts: 10 },
]

export function GeneralMetrics() {
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Growth Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="members" stroke="#8884d8" name="Total Members" />
                <Line yAxisId="left" type="monotone" dataKey="attendance" stroke="#82ca9d" name="Avg. Attendance" />
                <Line yAxisId="right" type="monotone" dataKey="newConverts" stroke="#ffc658" name="New Converts" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data[data.length - 1].members}</p>
            <p className="text-sm text-muted-foreground">
              +{data[data.length - 1].members - data[0].members} in the last 12 months
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Average Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data[data.length - 1].attendance}</p>
            <p className="text-sm text-muted-foreground">
              {((data[data.length - 1].attendance / data[data.length - 1].members) * 100).toFixed(1)}% of total members
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>New Converts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{data.reduce((sum, item) => sum + item.newConverts, 0)}</p>
            <p className="text-sm text-muted-foreground">
              In the last 12 months
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

