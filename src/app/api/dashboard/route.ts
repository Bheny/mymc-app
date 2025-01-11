import { NextResponse } from 'next/server'

export async function GET() {
  // In a real application, you would fetch this data from your database
  const dashboardData = {
    totalMembers: 180,
    totalCells: 12,
    avgAttendance: 150,
    attendanceRate: "83%",
    monthlyOutreach: 4,
    soulsWon: 15,
    recentActivities: [
      { id: 1, type: 'new-member', description: 'Sarah Johnson joined Cell A', date: '2 hours ago' },
      { id: 2, type: 'attendance', description: 'Cell B reported 100% attendance', date: 'Yesterday' },
      { id: 3, type: 'event', description: 'Upcoming event: Monthly Prayer Meeting', date: 'Next week' },
      { id: 4, type: 'achievement', description: 'Cell C won 5 souls this month', date: '3 days ago' },
    ],
    upcomingEvents: [
      { id: 1, title: 'Monthly Prayer Meeting', date: '2023-06-15', time: '7:00 PM - 8:30 PM', location: 'Main Sanctuary' },
      { id: 2, title: 'Cell Leaders Training', date: '2023-06-20', time: '6:30 PM - 8:00 PM', location: 'Conference Room A' },
      { id: 3, title: 'Community Outreach', date: '2023-06-25', time: '10:00 AM - 2:00 PM', location: 'City Park' },
    ],
    topPerformingCells: [
      { id: 1, name: 'Cell A', leader: 'John Smith', members: 20, attendanceRate: 95, soulsWon: 7 },
      { id: 2, name: 'Cell B', leader: 'Jane Doe', members: 18, attendanceRate: 92, soulsWon: 5 },
      { id: 3, name: 'Cell C', leader: 'Mike Johnson', members: 15, attendanceRate: 88, soulsWon: 4 },
    ],
    topPerformingShepherds: [
      { id: 1, name: 'John Smith', cellName: 'Cell A', membersLed: 20, soulsWon: 7, performanceScore: 95 },
      { id: 2, name: 'Jane Doe', cellName: 'Cell B', membersLed: 18, soulsWon: 5, performanceScore: 92 },
      { id: 3, name: 'Mike Johnson', cellName: 'Cell C', membersLed: 15, soulsWon: 4, performanceScore: 88 },
    ],
  }

  return NextResponse.json(dashboardData)
}

