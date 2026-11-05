"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateEventModal({ isOpen, onClose }: CreateEventModalProps) {
  const [eventData, setEventData] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    type: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setEventData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string) => {
    setEventData(prev => ({ ...prev, type: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically handle the form submission,
    // e.g., sending the data to an API
    console.log("Event data:", eventData)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Enter the details of the new event here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-1.5 sm:gap-4">
              <Label htmlFor="title" className="sm:text-right">
                Title
              </Label>
              <Input id="title" name="title" className="sm:col-span-3" onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-1.5 sm:gap-4">
              <Label htmlFor="date" className="sm:text-right">
                Date
              </Label>
              <Input id="date" name="date" type="date" className="sm:col-span-3" onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-1.5 sm:gap-4">
              <Label htmlFor="time" className="sm:text-right">
                Time
              </Label>
              <Input id="time" name="time" type="time" className="sm:col-span-3" onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-1.5 sm:gap-4">
              <Label htmlFor="location" className="sm:text-right">
                Location
              </Label>
              <Input id="location" name="location" className="sm:col-span-3" onChange={handleChange} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-1.5 sm:gap-4">
              <Label htmlFor="type" className="sm:text-right">
                Type
              </Label>
              <Select onValueChange={handleSelectChange}>
                <SelectTrigger className="sm:col-span-3">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prayer">Prayer</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="outreach">Outreach</SelectItem>
                  <SelectItem value="fellowship">Fellowship</SelectItem>
                  <SelectItem value="study">Study</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Event</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

