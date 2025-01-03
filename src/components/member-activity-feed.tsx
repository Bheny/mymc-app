import { Card, CardContent } from "@/components/ui/card"
import { UserCheck, UserPlus, Book, Award } from 'lucide-react'

const activities = [
  { id: 1, type: 'attendance', description: 'Attended Sunday Service', date: '2023-06-01' },
  { id: 2, type: 'soul', description: 'Won a new soul: Sarah Johnson', date: '2023-05-28' },
  { id: 3, type: 'discipleship', description: 'Completed Basic Discipleship Course', date: '2023-05-15' },
  { id: 4, type: 'achievement', description: 'Received "Faithful Servant" Award', date: '2023-05-01' },
  { id: 5, type: 'attendance', description: 'Attended Cell Group Meeting', date: '2023-04-25' },
]

const iconMap = {
  attendance: UserCheck,
  soul: UserPlus,
  discipleship: Book,
  achievement: Award,
}

export function MemberActivityFeed() {
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y divide-gray-200">
          {activities.map((activity) => {
            const Icon = iconMap[activity.type as keyof typeof iconMap]
            return (
              <li key={activity.id} className="p-4">
                <div className="flex space-x-3">
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    activity.type === 'attendance' ? 'bg-blue-100' :
                    activity.type === 'soul' ? 'bg-green-100' :
                    activity.type === 'discipleship' ? 'bg-yellow-100' :
                    'bg-purple-100'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      activity.type === 'attendance' ? 'text-blue-600' :
                      activity.type === 'soul' ? 'text-green-600' :
                      activity.type === 'discipleship' ? 'text-yellow-600' :
                      'text-purple-600'
                    }`} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">{activity.description}</h3>
                      <p className="text-sm text-gray-500">{activity.date}</p>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

