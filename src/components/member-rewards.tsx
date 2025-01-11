"use client"
import { useState } from 'react'
import { Trophy, Star, Zap, ChevronRight } from 'lucide-react'
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Reward {
  id: number;
  name: string;
  description: string;
  icon: React.ReactNode;
}

interface MemberRewardsProps {
  weeklyPoints: number;
  totalPoints: number;
  streak: number;
  rewards: Reward[];
}

export function MemberRewards({ weeklyPoints, totalPoints, streak, rewards }: MemberRewardsProps) {
  const [progress, setProgress] = useState(66)

  setProgress(79);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold"> Rewards</CardTitle>
        <CardDescription>Track member&apos;s progress and rewards earned8</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Weekly Points:</span>
          </div>
          <span className="text-lg font-bold">{weeklyPoints}</span>
        </div>
        <Progress value={progress} className="w-full" />
        <p className="text-sm text-muted-foreground text-center">
          {progress}% progress to next level
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-purple-500" />
            <span className="font-semibold">Total Points:</span>
          </div>
          <span className="text-lg font-bold">{totalPoints}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-blue-500" />
            <span className="font-semibold">Streak:</span>
          </div>
          <span className="text-lg font-bold">{streak} days</span>
        </div>
      </CardContent>
      <CardFooter>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              View All Rewards <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Your Rewards</DialogTitle>
              <DialogDescription>
                Here are all the rewards you&apos;ve earned so far.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {rewards.map((reward) => (
                <div key={reward.id} className="flex items-center space-x-4">
                  <div className="flex-shrink-0">{reward.icon}</div>
                  <div>
                    <h4 className="font-semibold">{reward.name}</h4>
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  )
}

