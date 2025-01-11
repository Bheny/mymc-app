import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from "@/components/ui/dialog"
  import { ScrollArea } from "@/components/ui/scroll-area"
  import { Users, UserCheck, UserPlus, MapPin, Calendar, TrendingUp, TrendingDown, Briefcase } from 'lucide-react'
  
  interface CellInfo {
    name: string
    startedBy: string
    headedBy: string
    assistedBy: string[]
    shepherds: number
    shepherdsInTraining: number
    members: number
    outreaches: number
    attendanceRate: number
    areaCovered: string
    membersInDepartments: number
    lowestAttendance: {
      record: number
      member: string
    }
    highestAttendance: {
      record: number
      member: string
    }
  }
  
  interface CellInfoModalProps {
    isOpen: boolean
    onClose: () => void
    cellInfo: CellInfo 
  }
  
  export function CellInfoModal({ isOpen, onClose, cellInfo }: CellInfoModalProps) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{cellInfo.name} Cell Information</DialogTitle>
            <DialogDescription>Quick summary of the cell&apos;s key metrics and information.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] mt-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Started by:</span>
                </div>
                <span className="text-sm">{cellInfo.startedBy}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <UserCheck className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Headed by:</span>
                </div>
                <span className="text-sm">{cellInfo.headedBy}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Assisted by:</span>
                </div>
                <span className="text-sm">{cellInfo.assistedBy.join(", ")}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Shepherds:</span>
                </div>
                <span className="text-sm">{cellInfo.shepherds}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Shepherds in Training:</span>
                </div>
                <span className="text-sm">{cellInfo.shepherdsInTraining}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <Users className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Cell Members:</span>
                </div>
                <span className="text-sm">{cellInfo.members}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Outreaches:</span>
                </div>
                <span className="text-sm">{cellInfo.outreaches}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Attendance Rate:</span>
                </div>
                <span className="text-sm">{cellInfo.attendanceRate}%</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Area Covered:</span>
                </div>
                <span className="text-sm">{cellInfo.areaCovered}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <Briefcase className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Members in Departments:</span>
                </div>
                <span className="text-sm">{cellInfo.membersInDepartments}</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Lowest Attendance:</span>
                </div>
                <span className="text-sm">{cellInfo.lowestAttendance.record} ({cellInfo.lowestAttendance.member})</span>
              </div>
              <div className="grid grid-cols-2 items-center gap-4">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Highest Attendance:</span>
                </div>
                <span className="text-sm">{cellInfo.highestAttendance.record} ({cellInfo.highestAttendance.member})</span>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    )
  }
  
  