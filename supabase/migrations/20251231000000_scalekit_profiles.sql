-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create a public profiles table
create table if not exists public.profiles (
  id uuid primary key, -- Must be UUID to match auth.uid()
  email text not null,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone,
  constraint profiles_email_key unique (email)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Create a policy: Users can only see their own profile
create policy "Users can view own profile"
on public.profiles for select
to authenticated
using ( auth.uid() = id );

-- Create a policy: Users can update their own profile
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ( auth.uid() = id );
