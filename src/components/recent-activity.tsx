import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, UserCheck, Calendar, Star } from 'lucide-react'

type Activity = {
  id: number
  type: 'new-member' | 'attendance' | 'event' | 'achievement'
  description: string
  date: string
}

const activityIcons = {
  'new-member': UserPlus,
  'attendance': UserCheck,
  'event': Calendar,
  'achievement': Star,
}

export function RecentActivity({ activities }: { activities: Activity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {activities.map((activity) => {
            const Icon = activityIcons[activity.type]
            return (
              <li key={activity.id} className="flex items-start space-x-4">
                <div className="bg-blue-100 rounded-full p-2">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                  <p className="text-xs text-gray-500">{activity.date}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

