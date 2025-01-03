import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, TrendingUp, Users } from 'lucide-react'

type Cell = {
  id: number
  name: string
  leader: string
  members: number
  attendanceRate: number
  soulsWon: number
}

export function TopPerformingCells({ cells }: { cells: Cell[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Top Performing Cells</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cells.map((cell) => (
            <div key={cell.id} className="flex items-center space-x-4">
              <div className="flex-1">
                <h3 className="text-sm font-medium">{cell.name}</h3>
                <p className="text-xs text-gray-500">Led by {cell.leader}</p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <div className="flex items-center space-x-1">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span>{cell.members}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>{cell.attendanceRate}%</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span>{cell.soulsWon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

