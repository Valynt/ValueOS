export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">
            Total Users
          </h3>
          <p className="text-3xl font-bold mt-2">1,234</p>
        </div>
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">Revenue</h3>
          <p className="text-3xl font-bold mt-2">$12,345</p>
        </div>
        <div className="border rounded-lg p-6 bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">
            Active Projects
          </h3>
          <p className="text-3xl font-bold mt-2">42</p>
        </div>
      </div>
    </div>
  );
}
