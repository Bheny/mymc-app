import Link from 'next/link'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar, Clock, MapPin } from 'lucide-react'

interface EventCardProps {
  event: {
    id: number
    title: string
    date: string
    time: string
    location: string
    type: string
  }
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{event.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center">
            <Calendar className="mr-2 h-4 w-4 opacity-70" /> 
            <span>{event.date}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-4 w-4 opacity-70" /> 
            <span>{event.time}</span>
          </div>
          <div className="flex items-center">
            <MapPin className="mr-2 h-4 w-4 opacity-70" /> 
            <span>{event.location}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">
          {event.type}
        </Button>
        <Link href={`/events/${event.id}`} passHref>
          <Button variant="default" size="sm">View Details</Button>
        </Link>
      </CardFooter>
    </Card>
  )
}

