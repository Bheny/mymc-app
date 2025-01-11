"use client"

import { useState } from 'react'
import { CellInfoModal } from '@/components/cell-info-modal'
import { CellSummaryCard } from './cell-summary-card'

interface CellData {
  name: string
  totalMembers: number
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

interface CellSummaryProps {
  cellData: CellData[]
}

export function CellSummary({ cellData }: CellSummaryProps) {
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null)

  const handleCellClick = (cell: CellData) => {
    setSelectedCell(cell)
  }

  const handleCloseModal = () => {
    setSelectedCell(null)
  }

  return (
    <>
      <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-6 gap-2 mb-6">
        {cellData.map((cell, index) => (
          <CellSummaryCard 
            key={index}
            title={cell.name}
            value={cell.totalMembers}
            onClick={() => handleCellClick(cell)}
          />
        ))}
      </div>
      {selectedCell && (
        <CellInfoModal
          isOpen={!!selectedCell}
          onClose={handleCloseModal}
          cellInfo={selectedCell}
        />
      )}
    </>
  )
}

