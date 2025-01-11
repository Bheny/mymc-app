"use client"

import { useState } from "react"
import { Plus, Trash2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { ScrollArea } from "@/components/ui/scroll-area"

interface Permission {
  id: string
  name: string
  description: string
}

interface UserGroup {
  id: string
  name: string
  permissions: string[]
}

const initialPermissions: Permission[] = [
  { id: "view_members", name: "View Members", description: "Can view member profiles" },
  { id: "edit_members", name: "Edit Members", description: "Can edit member information" },
  { id: "view_events", name: "View Events", description: "Can view event details" },
  { id: "create_events", name: "Create Events", description: "Can create new events" },
  { id: "edit_events", name: "Edit Events", description: "Can edit existing events" },
  { id: "view_reports", name: "View Reports", description: "Can view MC reports" },
  { id: "generate_reports", name: "Generate Reports", description: "Can generate new reports" },
  { id: "manage_settings", name: "Manage Settings", description: "Can modify MC settings" },
]

const initialGroups: UserGroup[] = [
  { id: "admin", name: "Admin", permissions: initialPermissions.map(p => p.id) },
  { id: "leader", name: "Leader", permissions: ["view_members", "view_events", "create_events", "edit_events", "view_reports"] },
  { id: "member", name: "Member", permissions: ["view_members", "view_events"] },
]

export function UserGroupsAndPermissions() {
  const [groups, setGroups] = useState<UserGroup[]>(initialGroups)
  const [permissions] = useState<Permission[]>(initialPermissions)
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null)
  const [isAddingGroup, setIsAddingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  const handleSelectGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId)
    setSelectedGroup(group || null)
  }

  const handleTogglePermission = (permissionId: string) => {
    if (!selectedGroup) return

    setSelectedGroup(prevGroup => {
      if (!prevGroup) return null

      const updatedPermissions = prevGroup.permissions.includes(permissionId)
        ? prevGroup.permissions.filter(id => id !== permissionId)
        : [...prevGroup.permissions, permissionId]

      return { ...prevGroup, permissions: updatedPermissions }
    })
  }

  const handleSaveGroup = () => {
    if (!selectedGroup) return

    setGroups(prevGroups => 
      prevGroups.map(group => 
        group.id === selectedGroup.id ? selectedGroup : group
      )
    )
  }

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return

    const newGroup: UserGroup = {
      id: newGroupName.toLowerCase().replace(/\s+/g, '_'),
      name: newGroupName.trim(),
      permissions: [],
    }

    setGroups(prevGroups => [...prevGroups, newGroup])
    setNewGroupName("")
    setIsAddingGroup(false)
  }

  const handleDeleteGroup = (groupId: string) => {
    setGroups(prevGroups => prevGroups.filter(group => group.id !== groupId))
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User Groups & Permissions</CardTitle>
        <CardDescription>Manage access permissions for your MC</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-4">
          <div className="w-1/3">
            <h3 className="text-lg font-semibold mb-2">User Groups</h3>
            <ScrollArea className="h-[300px]">
              {groups.map(group => (
                <div key={group.id} className="flex items-center justify-between mb-2">
                  <Button
                    variant={selectedGroup?.id === group.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => handleSelectGroup(group.id)}
                  >
                    {group.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </ScrollArea>
            <Dialog open={isAddingGroup} onOpenChange={setIsAddingGroup}>
              <DialogTrigger asChild>
                <Button className="w-full mt-2">
                  <Plus className="mr-2 h-4 w-4" /> Add Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Group</DialogTitle>
                  <DialogDescription>
                    Create a new user group for your MC.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="col-span-3"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddGroup}>Add Group</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="w-2/3">
            <h3 className="text-lg font-semibold mb-2">Permissions</h3>
            {selectedGroup ? (
              <ScrollArea className="h-[300px]">
                {permissions.map(permission => (
                  <div key={permission.id} className="flex items-start space-x-2 mb-2">
                    <Checkbox
                      id={permission.id}
                      checked={selectedGroup.permissions.includes(permission.id)}
                      onCheckedChange={() => handleTogglePermission(permission.id)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={permission.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {permission.name}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {permission.description}
                      </p>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground">Select a group to manage permissions</p>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveGroup} disabled={!selectedGroup}>
          Save Changes
        </Button>
      </CardFooter>
    </Card>
  )
}

