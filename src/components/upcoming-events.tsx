import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, Clock, MapPin } from 'lucide-react'

type Event = {
  id: number
  title: string
  date: string
  time: string
  location: string
}

export function UpcomingEvents({ events }: { events: Event[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="h-5 w-5" />
          <span>Upcoming Events</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="flex flex-col space-y-2 p-3 bg-[#e5effd] rounded-md">
              <h3 className="text-sm font-medium">{event.title}</h3>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{event.date}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{event.time}</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{event.location}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

