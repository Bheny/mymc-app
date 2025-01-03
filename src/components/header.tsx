import { UserCircle } from 'lucide-react'

export function Header({ mcHeadName }: { mcHeadName: string }) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">MyMC App</h1>
        <div className="flex items-center">
          <UserCircle className="h-8 w-8 text-gray-400" />
          <span className="ml-2 text-sm font-medium text-gray-700">{mcHeadName}</span>
        </div>
      </div>
    </header>
  )
}

