"use client"

import { useState, useEffect } from "react"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, Search } from 'lucide-react'

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  attendanceRate: number;
  soulsWon: number;
  discipleshipLevel: string;
  photo: string;
  department: string;
  shepherd: string;
  branch: string;
  broughtBy: string;
  location: string;
  cell: string;
  status: string;
  rank: string;
  joinDate: string;
  last_seen: string;
}

interface EditMemberModalProps {
  member: Member;
  onSave: (updatedMember: Member) => void;
}

export function EditMemberModal({ member, onSave }: EditMemberModalProps) {
  const [open, setOpen] = useState(false)
  const [editedMember, setEditedMember] = useState<Member>(member)
  const [searchTerm, setSearchTerm] = useState(member.broughtBy)
  const [searchResults, setSearchResults] = useState<string[]>([])

  useEffect(() => {
    setEditedMember(member)
  }, [member])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onSave(editedMember)
    setOpen(false)
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setEditedMember(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setEditedMember(prev => ({ ...prev, [name]: value }))
  }

  const handleSearch = (term: string) => {
    setSearchTerm(term)
    setEditedMember(prev => ({ ...prev, broughtBy: term }))
    // This is a mock search. In a real app, you'd typically make an API call here.
    const mockResults = ["John Doe", "Jane Smith", "Bob Johnson"].filter(name =>
      name.toLowerCase().includes(term.toLowerCase())
    )
    setSearchResults(mockResults)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Edit className="mr-2 h-4 w-4" /> Edit Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Make changes to the member&apos;s information here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">
                First Name
              </Label>
              <Input
                id="firstName"
                name="firstName"
                value={editedMember.firstName}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">
                Last Name
              </Label>
              <Input
                id="lastName"
                name="lastName"
                value={editedMember.lastName}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="contact" className="text-right">
                Contact
              </Label>
              <Input
                id="contact"
                name="contact"
                value={editedMember.phone}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="broughtBy" className="text-right">
                Brought By
              </Label>
              <div className="col-span-3 relative">
                <Input
                  id="broughtBy"
                  name="broughtBy"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pr-8"
                />
                <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
                {searchResults.length > 0 && (
                  <ul className="absolute z-10 w-full bg-white border rounded-md mt-1 max-h-32 overflow-auto">
                    {searchResults.map((result, index) => (
                      <li
                        key={index}
                        className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          handleSearch(result)
                          setSearchResults([])
                        }}
                      >
                        {result}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">
                Location
              </Label>
              <Input
                id="location"
                name="location"
                value={editedMember.location}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cell" className="text-right">
                Cell
              </Label>
              <Select
                value={editedMember.cell}
                onValueChange={(value) => handleSelectChange("cell", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a cell" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cell-a">Biazo</SelectItem>
                  <SelectItem value="cell-b">Paraclete</SelectItem>
                  <SelectItem value="cell-c">Joy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={editedMember.status}
                onValueChange={(value) => handleSelectChange("status", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="joinDate" className="text-right">
                Join Date
              </Label>
              <Input
                id="joinDate"
                name="joinDate"
                type="date"
                value={editedMember.joinDate}
                onChange={handleInputChange}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

