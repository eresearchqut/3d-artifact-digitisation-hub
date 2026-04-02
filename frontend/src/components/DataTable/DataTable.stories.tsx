// @ts-ignore
import { DataTable } from './DataTable';

const meta = {
  title: 'Components/DataTable',
  component: DataTable,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}; // @ts-ignore
export default meta;


interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const mockData: User[] = [
  { id: '1', name: 'Alice', email: 'alice@example.com', role: 'Admin' },
  { id: '2', name: 'Bob', email: 'bob@example.com', role: 'User' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'User' },
];

const columns = [
  { key: 'id', header: 'ID', cellClassName: 'text-gray-500 font-mono' },
  { key: 'name', header: 'Name', cellClassName: 'font-medium text-gray-900' },
  { key: 'email', header: 'Email' },
  { 
    key: 'role', 
    header: 'Role',
    render: (row: User) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.role === 'Admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
        {row.role}
      </span>
    )
  },
  {
    key: 'actions',
    header: 'Actions',
    headerClassName: 'text-right',
    cellClassName: 'text-right',
    render: () => (
      <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">Edit</button>
    )
  }
];

export const Default: any = {
  args: {
    data: mockData,
    columns: columns as any,
    keyExtractor: (row: any) => row.id,
    emptyMessage: 'No users found.',
  },
  render: (args: any) => (
    <div className="w-[800px]">
      <DataTable {...args} />
    </div>
  )
};

export const Empty: any = {
  args: {
    data: [],
    columns: columns as any,
    keyExtractor: (row: any) => row.id,
    emptyMessage: 'No data available. Please create a new record.',
  },
  render: (args: any) => (
    <div className="w-[800px]">
      <DataTable {...args} />
    </div>
  )
};
