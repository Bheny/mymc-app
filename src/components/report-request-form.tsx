"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { toast } from '@/hooks/use-toast'


const reportTypes = [
  { id: 'retention', label: 'Member Retention' },
  { id: 'shepherd-members', label: 'Shepherd vs Members Ratio' },
  { id: 'conversion', label: 'Conversion Rates' },
  { id: 'attendance', label: 'Attendance Trends' },
  { id: 'growth', label: 'Cell Group Growth' },
]

export function ReportRequestForm() {
  const [selectedReportType, setSelectedReportType] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [additionalNotes, setAdditionalNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would typically send the report request to your backend
    console.log('Report Request:', { selectedReportType, dateRange, additionalNotes })
    toast({
      title: "Report Requested",
      description: `Your ${selectedReportType} report has been requested.`,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label>Report Type</Label>
        <RadioGroup value={selectedReportType} onValueChange={setSelectedReportType}>
          {reportTypes.map((type) => (
            <div key={type.id} className="flex items-center space-x-2">
              <RadioGroupItem value={type.id} id={type.id} />
              <Label htmlFor={type.id}>{type.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-date">Start Date</Label>
          <Input
            id="start-date"
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="end-date">End Date</Label>
          <Input
            id="end-date"
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="additional-notes">Additional Notes</Label>
        <Textarea
          id="additional-notes"
          placeholder="Any specific metrics or insights you're looking for?"
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
        />
      </div>
      
      <Button type="submit">Request Report</Button>
    </form>
  )
}

