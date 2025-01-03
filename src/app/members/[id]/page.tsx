import { Header } from '@/components/header'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AttendanceChart } from '@/components/attendance-chart'
import { MemberActivityFeed } from '@/components/member-activity-feed'
import { CalendarIcon, PhoneIcon, MailIcon, MapPinIcon, Edit } from 'lucide-react'

// Mock data for the member
const member = {
  id: 1,
  name: "Bernard Tay",
  email: "benardk.tay@gmail.com",
  phone: "0552274951",
  address: "Old Housing Estate",
  joinDate: "2022-01-15",
  last_seen : "2022-01-15",
  cell: "Kairos Cell",
  status: "Active",
  role: "Cell Leader",
  attendanceRate: 85,
  soulsWon: 7,
  discipleshipLevel: "Intermediate",
  photo: "/placeholder.svg",
  department: "Media",
  shepherd: "Elder Favour",
  branch: "Ho",
  rank: "Shepherd"
}

export default function MemberDetailsPage() {
  return (
    <div className="min-h-screen h-full bg-background">
      <Header mcHeadName="Elder Favour" />
      <main className=" max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 mb-64">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-semibold text-foreground">Member Details</h1>
            <Button>
              <Edit className="mr-2 h-4 w-4" /> Edit Member
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 ">
            {/* Left column: Member info */}
            <div className="md:col-span-1">
              <Card>
                <CardHeader className="text-center">
                  <Avatar className="w-32 h-32 mx-auto">
                    <AvatarImage src={member.photo} alt={member.name} />
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="mt-4">{member.name}</CardTitle>
                  <CardDescription>{member.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center">
                      <MailIcon className="mr-2 h-4 w-4 opacity-70" /> {member.email}
                    </div>
                    <div className="flex items-center">
                      <PhoneIcon className="mr-2 h-4 w-4 opacity-70" /> {member.phone}
                    </div>
                    <div className="flex items-center">
                      <MapPinIcon className="mr-2 h-4 w-4 opacity-70" /> {member.address}
                    </div>
                    <div className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4 opacity-70" /> Joined: {member.joinDate}
                    </div>
                    <div className="flex items-center">
                      <CalendarIcon className="mr-2 h-4 w-4 opacity-70" /> Last Seen: {member.last_seen}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{member.cell}</Badge>
                      <Badge variant="outline">{member.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Right column: Tabs with charts and activity */}
            <div className="md:col-span-2 space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="attendance">Attendance</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <Card>
                    <CardHeader>
                      <CardTitle>Member Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Attendance Rate</p>
                          <p className="text-2xl font-bold">{member.attendanceRate}%</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Souls Won</p>
                          <p className="text-2xl font-bold">{member.soulsWon}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Discipleship Level</p>
                          <p className="text-2xl font-bold">{member.discipleshipLevel}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Cell</p>
                          <p className="text-2xl font-bold">{member.cell}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Shepherd</p>
                          <p className="text-2xl font-bold">{member.shepherd}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Department</p>
                          <p className="text-2xl font-bold">{member.department}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Branch</p>
                          <p className="text-2xl font-bold">{member.branch}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Rank</p>
                          <p className="text-2xl font-bold">{member.rank}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="attendance">
                  <Card>
                    <CardHeader>
                      <CardTitle>Attendance Chart</CardTitle>
                      <CardDescription>Monthly attendance over the past year</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <AttendanceChart />
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="activity">
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MemberActivityFeed />
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

