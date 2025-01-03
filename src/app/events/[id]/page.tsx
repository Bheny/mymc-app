"use client"

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar, Clock, MapPin, Users, Edit, Trash2 } from 'lucide-react'

// Mock data for a single event (in a real app, you'd fetch this based on the ID)
const event = {
  id: 1,
  title: 'Monthly Prayer Meeting',
  date: '2023-06-15',
  time: '19:00',
  location: 'Main Sanctuary',
  type: 'Prayer',
  description: 'Join us for our monthly prayer meeting where we come together as a community to lift up our prayers and petitions.',
  organizer: 'Jane Smith',
  attendees: [
    { id: 1, name: 'John Doe', photo: '/placeholder.svg' },
    { id: 2, name: 'Alice Johnson', photo: '/placeholder.svg' },
    { id: 3, name: 'Bob Williams', photo: '/placeholder.svg' },
    // ... more attendees
  ]
}

export default function EventDetailsPage() {
  const params = useParams()
  const [isEditing, setIsEditing] = useState(false)

  // In a real app, you'd fetch the event data based on the ID
  console.log("Event ID:", params.id)

  return (
    <div className="min-h-screen bg-background">
      <Header mcHeadName="John Doe" />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-semibold text-foreground">{event.title}</h1>
            <div className="space-x-2">
              <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Event
              </Button>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Event
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
                <CardDescription>{event.type} Event</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Calendar className="mr-2 h-5 w-5 opacity-70" /> 
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="mr-2 h-5 w-5 opacity-70" /> 
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPin className="mr-2 h-5 w-5 opacity-70" /> 
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="mr-2 h-5 w-5 opacity-70" /> 
                    <span>Organizer: {event.organizer}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Description</h3>
                    <p>{event.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Attendees</CardTitle>
                <CardDescription>{event.attendees.length} people attending</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {event.attendees.map((attendee) => (
                    <Avatar key={attendee.id} title={attendee.name}>
                      <AvatarImage src={attendee.photo} alt={attendee.name} />
                      <AvatarFallback>{attendee.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

