import { getServerSession } from "next-auth/next"
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/profile-form'
import { Header } from '@/components/header'

export default async function ProfilePage() {
  const session = await getServerSession()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <Header mcHeadName={session.user.name || 'User'} />
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
        <ProfileForm user={session.user} />
      </main>
    </div>
  )
}

