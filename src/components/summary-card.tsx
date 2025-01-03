import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SummaryCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  target?: string | number
}

export function SummaryCard({ title, value, icon, target }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value} {target && <span className="text-sm text-gray-500">/{target}</span>}</div>
      </CardContent>
    </Card>
  )
}

