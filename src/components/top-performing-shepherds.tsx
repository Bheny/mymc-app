import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Users, UserPlus } from 'lucide-react'

type Shepherd = {
  id: number
  name: string
  cellName: string
  membersLed: number
  soulsWon: number
  performanceScore: number
}

export function TopPerformingShepherds({ shepherds }: { shepherds: Shepherd[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Top 10 Performing Shepherds</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {shepherds.slice(0, 10).map((shepherd, index) => (
            <div key={shepherd.id} className="flex items-center space-x-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 font-semibold">{index + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium">{shepherd.name}</h3>
                <p className="text-xs text-gray-500">{shepherd.cellName}</p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>{shepherd.membersLed}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <UserPlus className="h-4 w-4 text-green-500" />
                  <span>{shepherd.soulsWon}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span>{shepherd.performanceScore}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

