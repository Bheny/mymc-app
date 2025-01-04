"use client"

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserCircle, Search } from 'lucide-react'

// Mock data for members
const members = [
  { id: 1, name: 'John Doe', status: 'present' },
  { id: 2, name: 'Jane Smith', status: 'absent' },
  { id: 3, name: 'Mike Johnson', status: 'on-leave' },
  { id: 4, name: 'Emily Brown', status: 'present' },
  { id: 5, name: 'David Lee', status: 'absent' },
]

export function TakeAttendanceButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [attendanceData, setAttendanceData] = useState(members)

  const handleStatusChange = (memberId: number, newStatus: string) => {
    setAttendanceData(attendanceData.map(member => 
      member.id === memberId ? { ...member, status: newStatus } : member
    ))
  }

  const filteredMembers = attendanceData.filter(member => 
    member.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800'
      case 'absent':
        return 'bg-red-100 text-red-800'
      case 'on-leave':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Take Attendance</Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Take Attendance</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4 relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Search members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <UserCircle className="mr-2 h-5 w-5 text-gray-400" />
                        {member.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.status}
                        onValueChange={(value) => handleStatusChange(member.id, value)}
                      >
                        <SelectTrigger className={`w-[180px] ${getStatusColor(member.status)}`}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="on-leave">On Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

