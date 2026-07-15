export interface User {
  id: string;
  email: string;
  full_name: string;
  building_id: string;
  flat_id?: string | null;
  role: 'admin' | 'resident';
  created_at: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  total_flats: number;
  monthly_aidat: number;
  admin_id: string;
  invite_code?: string;
  created_at: string;
}

export interface Aidat {
  id: string;
  flat_id: string;
  building_id: string;
  amount: number;
  month: number;
  year: number;
  is_paid: boolean;
  paid_at?: string;
  created_at: string;
}

export interface Expense {
  id: string;
  building_id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  receipt_url?: string;
  created_by: string;
  created_at: string;
}

export interface Flat {
  id: string;
  building_id: string;
  floor: number;
  number: number;
  owner_name: string;
  owner_phone: string;
  owner_email?: string;
  is_rented: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  building_id: string;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
}

export interface Poll {
  id: string;
  building_id: string;
  title: string;
  description?: string;
  options: string[];
  created_by: string;
  creator_name?: string;
  expires_at?: string;
  votes: Record<number, number>;
  totalVotes: number;
  myVote: number | null;
  created_at: string;
}
