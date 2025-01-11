import React from 'react'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DisciplesTreeProps {
  disciples: Disciple[]
}

interface Disciple {
  id: string
  name: string
  avatar: string
  disciples: Disciple[]
}

const DisciplesTree: React.FC<DisciplesTreeProps> = ({ disciples }) => {
  return (
    <ul className="pl-4">
      {disciples.map((disciple) => (
        <li key={disciple.id} className="mb-2">
          <div className="flex items-center mb-1">
            <ChevronRight className="h-4 w-4 mr-2" />
            <Avatar className="h-6 w-6 mr-2">
              <AvatarImage src={disciple.avatar} alt={disciple.name} />
              <AvatarFallback>{disciple.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span>{disciple.name}</span>
          </div>
          {disciple.disciples.length > 0 && (
            <DisciplesTree disciples={disciple.disciples} />
          )}
        </li>
      ))}
    </ul>
  )
}

export function DiscipleshipLineage() {
  // This is mock data. In a real application, you would fetch this data from your API.
  const mockData: Disciple = {
    id: "1",
    name: "John Doe",
    avatar: "/avatars/john-doe.png",
    disciples: [
      {
        id: "2",
        name: "Alice Smith",
        avatar: "/avatars/alice-smith.png",
        disciples: [
          {
            id: "5",
            name: "Eva Brown",
            avatar: "/avatars/eva-brown.png",
            disciples: []
          },
          {
            id: "6",
            name: "Frank Wilson",
            avatar: "/avatars/frank-wilson.png",
            disciples: []
          }
        ]
      },
      {
        id: "3",
        name: "Bob Johnson",
        avatar: "/avatars/bob-johnson.png",
        disciples: [
          {
            id: "7",
            name: "Grace Lee",
            avatar: "/avatars/grace-lee.png",
            disciples: []
          }
        ]
      },
      {
        id: "4",
        name: "Carol Williams",
        avatar: "/avatars/carol-williams.png",
        disciples: []
      }
    ]
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-4">Discipleship Lineage</h3>
        <ScrollArea className="h-[300px] pr-4">
          <div className="flex items-center mb-4">
            <Avatar className="h-10 w-10 mr-4">
              <AvatarImage src={mockData.avatar} alt={mockData.name} />
              <AvatarFallback>{mockData.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-lg font-medium">{mockData.name}</span>
          </div>
          <DisciplesTree disciples={mockData.disciples} />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

