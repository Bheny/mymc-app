import { Header } from '../components/header'
import { SummaryCard } from '../components/summary-card'
import { RecentActivity } from '../components/recent-activity'
import { TopPerformingCells } from '../components/top-performing-cells'
import { TopPerformingShepherds } from '../components/top-performing-shepherds'
import { Users,  UserCheck, UserPlus, TrendingUp, BlocksIcon } from 'lucide-react'
import { UpcomingEvents } from '@/components/upcoming-events'

// Mock data (in a real app, you'd fetch this from an API or database)
const mcData = {
  mcHeadName: "Favour",
  totalMembers: 180,
  totalCells: 12,
  avgAttendance: 150,
  attendanceRate: "83%",
  soulsWon: 15
}

const recentActivities = [
  {
    id: 1,
    type: 'new-member' as const,
    description: 'Sarah Johnson joined Cell A',
    date: '2 hours ago'
  },
  {
    id: 2,
    type: 'attendance' as const,
    description: 'Cell B reported 100% attendance',
    date: 'Yesterday'
  },
  {
    id: 3,
    type: 'event' as const,
    description: 'Upcoming event: Monthly Prayer Meeting',
    date: 'Next week'
  },
  {
    id: 4,
    type: 'achievement' as const,
    description: 'Cell C won 5 souls this month',
    date: '3 days ago'
  },
]

const topPerformingCells = [
  { id: 1, name: 'Cell A', leader: 'John Smith', members: 20, attendanceRate: 95, soulsWon: 7 },
  { id: 2, name: 'Cell B', leader: 'Jane Doe', members: 18, attendanceRate: 92, soulsWon: 5 },
  { id: 3, name: 'Cell C', leader: 'Mike Johnson', members: 15, attendanceRate: 88, soulsWon: 4 },
  { id: 4, name: 'Cell D', leader: 'Emily Brown', members: 17, attendanceRate: 85, soulsWon: 3 },
  { id: 5, name: 'Cell E', leader: 'David Lee', members: 16, attendanceRate: 83, soulsWon: 2 },
]

const topPerformingShepherds = [
  { id: 1, name: 'John Smith', cellName: 'Cell A', membersLed: 20, soulsWon: 7, performanceScore: 95 },
  { id: 2, name: 'Jane Doe', cellName: 'Cell B', membersLed: 18, soulsWon: 5, performanceScore: 92 },
  { id: 3, name: 'Mike Johnson', cellName: 'Cell C', membersLed: 15, soulsWon: 4, performanceScore: 88 },
  { id: 4, name: 'Emily Brown', cellName: 'Cell D', membersLed: 17, soulsWon: 3, performanceScore: 85 },
  { id: 5, name: 'David Lee', cellName: 'Cell E', membersLed: 16, soulsWon: 2, performanceScore: 83 },
  { id: 6, name: 'Sarah Wilson', cellName: 'Cell F', membersLed: 19, soulsWon: 6, performanceScore: 91 },
  { id: 7, name: 'Michael Chen', cellName: 'Cell G', membersLed: 14, soulsWon: 3, performanceScore: 82 },
  { id: 8, name: 'Lisa Taylor', cellName: 'Cell H', membersLed: 18, soulsWon: 4, performanceScore: 87 },
  { id: 9, name: 'Robert Kim', cellName: 'Cell I', membersLed: 16, soulsWon: 5, performanceScore: 89 },
  { id: 10, name: 'Emma Garcia', cellName: 'Cell J', membersLed: 15, soulsWon: 3, performanceScore: 84 },
  { id: 11, name: 'Daniel Park', cellName: 'Cell K', membersLed: 17, soulsWon: 4, performanceScore: 86 },
  { id: 12, name: 'Olivia Nguyen', cellName: 'Cell L', membersLed: 14, soulsWon: 2, performanceScore: 80 },
]


const upcomingEvents = [
  { id: 1, title: 'Monthly Prayer Meeting', date: 'June 15, 2023', time: '7:00 PM - 8:30 PM', location: 'Main Auditorium' },
  { id: 2, title: 'Cell Leaders Training', date: 'June 20, 2023', time: '6:30 PM - 8:00 PM', location: 'Main Auditorium' },
  { id: 3, title: 'Community Outreach', date: 'June 25, 2023', time: '10:00 AM - 2:00 PM', location: 'HTU Park' },
  { id: 4, title: 'Youth Fellowship', date: 'July 1, 2023', time: '5:00 PM - 7:00 PM', location: 'Teens Auditorium' },
]


export default function OverviewPage() {
  return (
    <div>
      <Header mcHeadName={mcData.mcHeadName} />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 mb-16">
        <div className="px-4 py-6 sm:px-0">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Welcome, <span className='text-blue-500'>{mcData.mcHeadName}</span>! <br /> Here&apos;s what&apos;s happening in your MC:
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                <SummaryCard 
                  title="Total Members" 
                  value={mcData.totalMembers} 
                  target={200}
                  icon={<Users className="h-4 w-4 text-muted-foreground" />} 
                />
                <SummaryCard 
                  title="Total Cells" 
                  value={mcData.totalCells} 
                  target={20}
                  icon={<BlocksIcon className="h-4 w-4 text-muted-foreground" />} 
                />
                <SummaryCard 
                  title="Average Attendance" 
                  value={mcData.avgAttendance} 
                  icon={<UserCheck className="h-4 w-4 text-muted-foreground" />} 
                />
                <SummaryCard 
                  title="Attendance Rate" 
                  value={mcData.attendanceRate} 
                  icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} 
                />
                <SummaryCard 
                  title="Souls Won This Month" 
                  value={mcData.soulsWon} 
                  icon={<UserPlus className="h-4 w-4 text-muted-foreground" />} 
                />
              </div>
              <RecentActivity activities={recentActivities} />
              <UpcomingEvents events={upcomingEvents} />
              <TopPerformingCells cells={topPerformingCells} />
              <TopPerformingShepherds shepherds={topPerformingShepherds} />
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}

