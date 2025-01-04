"use client"

import { useState } from 'react'
import { Header } from '@/components/header'
import { EventCard } from '@/components/event-card'
import { CreateEventModal } from '@/components/create-event-modal'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlusCircle, Search} from 'lucide-react'

// Mock data for events
const events = [
 
  { id: 1, title: 'Monthly Prayer Meeting', date: '2023-06-15', time: '19:00', location: 'Main Sanctuary', type: 'Prayer' },
  { id: 2, title: 'Cell Leaders Training', date: '2023-06-20', time: '18:30', location: 'Conference Room A', type: 'Training' },
  { id: 3, title: 'Community Outreach', date: '2023-06-25', time: '10:00', location: 'City Park', type: 'Outreach' },
  { id: 4, title: 'Youth Fellowship', date: '2023-07-01', time: '17:00', location: 'Youth Center', type: 'Fellowship' },
  { id: 5, title: 'Bible Study', date: '2023-07-05', time: '19:30', location: 'Online (Zoom)', type: 'Study' },
  { id: 6 , title: 'Mega Gathering Service', date: '2023-06-15', time: '19:00', location: 'Main Sanctuary', type: 'Service' },
  { id: 7 , title: 'Them that love his appearing Service', date: '2023-06-15', time: '19:00', location: 'Main Sanctuary', type: 'Service' },

]

export default function EventsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Header mcHeadName="Elder Favour" />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-semibold text-foreground">Events</h1>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" /> Create Event
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
                <Input 
                  type="text" 
                  placeholder="Search events..." 
                  className="pl-10 w-full"
                />
              </div>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <Select>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="prayer">Prayer</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="outreach">Outreach</SelectItem>
                  <SelectItem value="fellowship">Fellowship</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" className="w-full sm:w-auto" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </main>
      <CreateEventModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  )
}

