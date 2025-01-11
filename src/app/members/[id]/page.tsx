"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AttendanceChart } from '@/components/attendance-chart'
import { MemberActivityFeed } from '@/components/member-activity-feed'
import { CalendarIcon, PhoneIcon, MailIcon, MapPinIcon,Star, Trophy, BookOpen } from 'lucide-react'
import { MemberRewards } from '@/components/member-rewards'
import { EditMemberModal } from '@/components/edit-member-modal'

// Mock data for the member
const member = {
  id: 1,
  firstName: "Bernard",
  lastName: "Tay",
  gender: "Male",
  email: "benardk.tay@gmail.com",
  phone: "0552274951",
  location: "Old Housing Estate",
  joinDate: "2022-01-15",
  last_seen : "2022-01-15",
  cell: "Kairos Cell",
  status: "Active",
  attendanceRate: 85,
  soulsWon: 7,
  discipleshipLevel: "Intermediate",
  photo: "/placeholder.svg",
  department: "Media",
  shepherd: "Elder Favour",
  branch: "Ho",
  rank: "Cell Shepherd",
  broughtBy: "Eli",

}

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


export default function MemberDetailsPage() {
  const handleSaveMember = (updatedMember : Member) => {
    // Here you would typically make an API call to update the member
    console.log('Saving updated member:', updatedMember)
  }
  return (
    <div className="min-h-screen h-full bg-background">
      {/* <Header mcHeadName="Elder Favour" /> */}
      <main className=" max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 mb-64">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-semibold text-foreground">Member Details</h1>
            <EditMemberModal member={member} onSave={handleSaveMember} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 ">
            {/* Left column: Member info */}
            <div className="md:col-span-1">
              <Card>
                <CardHeader className="text-center">
                  <Avatar className="w-32 h-32 mx-auto">
                    <AvatarImage src={member.photo} alt={member.firstName + ' ' + member.lastName} />
                    <AvatarFallback>{member.firstName[0]} {member.lastName[0]}</AvatarFallback>
                  </Avatar>
                  <CardTitle className="mt-4">{member.firstName} {member.lastName}</CardTitle>
                  <CardDescription>{member.rank}</CardDescription>
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
                      <MapPinIcon className="mr-2 h-4 w-4 opacity-70" /> {member.location}
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
                  <TabsTrigger value="discipleship">Discipleship</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                <MemberRewards 
                  weeklyPoints={75}
                  totalPoints={1250}
                  streak={14}
                  rewards={[
                    { id: 1, name: "First Prayer", description: "Attended your first prayer meeting", icon: <Star className="h-5 w-5 text-yellow-500" /> },
                    { id: 2, name: "Volunteer Hero", description: "Volunteered for 5 church events", icon: <Trophy className="h-5 w-5 text-purple-500" /> },
                    { id: 3, name: "Bible Scholar", description: "Completed 10 Bible study sessions", icon: <BookOpen className="h-5 w-5 text-green-500" /> },
                  ]}
                />
                  <Card>
                    <CardHeader>
                      <CardTitle>Member Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Attendance Rate</p>
                          <p className="text-xl md:text-2xl font-bold">{member.attendanceRate}%</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Souls Won</p>
                          <p className="text-xl md:text-2xl font-bold">{member.soulsWon}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Discipleship Level</p>
                          <p className="text-xl md:text-2xl font-bold text-wrap">{member.discipleshipLevel}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Cell</p>
                          <p className="text-xl md:text-2xl font-bold">{member.cell}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Shepherd</p>
                          <p className="text-xl md:text-2xl font-bold">{member.shepherd}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Department</p>
                          <p className="text-xl md:text-2xl font-bold">{member.department}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Branch</p>
                          <p className="text-xl md:text-2xl font-bold">{member.branch}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Rank</p>
                          <p className="text-xl md:text-2xl font-bold">{member.rank}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                <TabsContent value="attendance">
                  <Card className='p-0'>
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
            <div className="md:col-span-2 space-y-6">
            {/* <DiscipleshipLineage /> */}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

