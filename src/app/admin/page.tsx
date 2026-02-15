import prisma from "@/lib/prisma";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import Link from "next/link";

export default async function AdminDashboard() {
  // Get stats
  const [userCount, curriculumCount, cardCount, subjectCount] = await Promise.all([
    prisma.user.count(),
    prisma.curriculum.count(),
    prisma.card.count(),
    prisma.subject.count(),
  ]);

  const usersByRole = await prisma.user.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  const recentUsers = await prisma.user.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const recentCurricula = await prisma.curriculum.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isPublic: true, createdAt: true, author: { select: { name: true } } },
  });

  const roleStats = usersByRole.reduce((acc, r) => {
    acc[r.role] = r._count.role;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin Overview</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{userCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Users</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{curriculumCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Curricula</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{subjectCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Subjects</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{cardCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Cards</div>
          </CardBody>
        </Card>
      </div>

      {/* Role Breakdown */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Users by Role</h3>
        </CardHeader>
        <CardBody>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Admins: {roleStats.ADMIN || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Educators: {roleStats.EDUCATOR || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
              <span className="text-sm text-gray-600 dark:text-gray-400">Students: {roleStats.STUDENT || 0}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Users</h3>
            <Link href="/admin/users" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    user.role === "ADMIN"
                      ? "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                      : user.role === "EDUCATOR"
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                      : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  }`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Recent Curricula */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Curricula</h3>
            <Link href="/admin/curricula" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {recentCurricula.map((curriculum) => (
                <div key={curriculum.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">{curriculum.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">by {curriculum.author?.name}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    curriculum.isPublic
                      ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                  }`}>
                    {curriculum.isPublic ? "Public" : "Private"}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
