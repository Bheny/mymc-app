import { Header } from "../../components/header";
import { AddMemberModal } from "../../components/add-member-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Edit,
  Trash2,
  UserCircle
} from "lucide-react";
import { SummaryCard } from "@/components/summary-card";
import Link from "next/link";

// Mock data for members
const members = [
  {
    id: 1,
    name: "John Doe",
    cell: "Cell A",
    status: "Active",
    joinDate: "2022-01-15",
  },
  {
    id: 2,
    name: "Jane Smith",
    cell: "Cell B",
    status: "Inactive",
    joinDate: "2021-11-03",
  },
  {
    id: 3,
    name: "Mike Johnson",
    cell: "Cell A",
    status: "Active",
    joinDate: "2022-03-22",
  },
  {
    id: 4,
    name: "Emily Brown",
    cell: "Cell C",
    status: "Active",
    joinDate: "2022-02-10",
  },
  {
    id: 5,
    name: "David Lee",
    cell: "Cell B",
    status: "Active",
    joinDate: "2021-12-05",
  },
];

// const mcData = {
//   mcHeadName: "Favour",
//   totalMembers: 180,
//   totalCells: 12,
//   avgAttendance: 150,
//   attendanceRate: "83%",
//   soulsWon: 15,
// };

const cellData = [
  {
    name: "Power Cell",
    totalMembers: 9,
  },
  {
    name: "Biazo Cell",
    totalMembers: 4,
  },
  {
    name: "Kairos Cell",
    totalMembers: 10,
  },
  {
    name: "Joy Cell",
    totalMembers: 9,
  },
  {
    name: "Paraclete Cell",
    totalMembers: 5,
  },
  {
    name: "Zoe Cell",
    totalMembers: 12,
  },
];

export default function MembersPage() {
  return (
    <div className="min-h-screen bg-background ">
      <Header mcHeadName="Favour" />
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-foreground">
              Members (197)
            </h1>
            <AddMemberModal />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-2 gap-4 mb-6">
            {cellData &&
              cellData.map((cellData, index) => (
                <SummaryCard
                  title={cellData.name}
                  value={cellData.totalMembers}
                  // target={200}
                  key={index}
                  // icon={<Users className="h-4 w-4 text-muted-foreground" />}
                />
              ))}
          </div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative ">
                <Search
                  className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                  size={20}
                />
                <Input
                  type="text"
                  placeholder="Search members..."
                  className="pl-10 w-full"
                />
              </div>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <Select>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter by cell" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cells</SelectItem>
                  <SelectItem value="cell-a">Cell A</SelectItem>
                  <SelectItem value="cell-b">Cell B</SelectItem>
                  <SelectItem value="cell-c">Cell C</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Name</TableHead>
                <TableHead>Cell</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <UserCircle className="mr-2 h-5 w-5 text-muted-foreground" />
                      <Link
                        href={`/members/${member.id}`}
                        className="text-blue-600 underline"
                      >
                        {member.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>{member.cell}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        member.status === "Active"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {member.status}
                    </span>
                  </TableCell>
                  <TableCell>{member.joinDate}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
