-- Banter core schema — shared Supabase project with the custom PM platform

create extension if not exists "pgcrypto";

-- Profiles (1:1 with auth.users; shared identity with PM)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  avatar_url text,
  status text not null default 'offline' check (status in ('online', 'away', 'offline')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Channels
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_private boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.channel_members (
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

-- Direct message conversations (exactly two participants for MVP)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

-- Messages (channel or DM; threads via parent_id)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  parent_id uuid references public.messages (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint message_target check (
    (channel_id is not null and conversation_id is null)
    or (channel_id is null and conversation_id is not null)
  )
);

create index messages_channel_created_idx on public.messages (channel_id, created_at desc);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_parent_idx on public.messages (parent_id, created_at);

-- Reactions
create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (
    type in (
      'mention',
      'dm',
      'thread_reply',
      'task_assigned',
      'task_updated',
      'task_comment',
      'deadline'
    )
  ),
  title text not null,
  body text,
  link text,
  pm_deep_link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

-- Auto-create profile on signup (shared with PM)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seed default cohort channels
insert into public.channels (slug, name, description) values
  ('general', 'General', 'Cohort-wide conversation'),
  ('announcements', 'Announcements', 'Official updates'),
  ('project-1', 'Project 1', 'Project 1 coordination'),
  ('backend-help', 'Backend Help', 'Backend questions and support'),
  ('ai-discussions', 'AI Discussions', 'AI topics and experiments'),
  ('career', 'Career', 'Jobs, networking, advice'),
  ('random', 'Random', 'Off-topic banter');

-- RLS
alter table public.profiles enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.notifications enable row level security;

-- Profiles
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- Channels: public channels visible to all; private only to members
create policy "Public channels are visible"
  on public.channels for select to authenticated
  using (
    not is_private
    or exists (
      select 1 from public.channel_members cm
      where cm.channel_id = id and cm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create channels"
  on public.channels for insert to authenticated
  with check (auth.uid() = created_by);

-- Channel members
create policy "Members can view membership"
  on public.channel_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.channel_members cm
      where cm.channel_id = channel_id and cm.user_id = auth.uid()
    )
  );

create policy "Users can join public channels"
  on public.channel_members for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.channels c
      where c.id = channel_id and not c.is_private
    )
  );

create policy "Users can leave channels"
  on public.channel_members for delete to authenticated
  using (user_id = auth.uid());

-- Conversations
create policy "Participants can view conversations"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

create policy "Authenticated users can create conversations"
  on public.conversations for insert to authenticated
  with check (true);

create policy "Participants can view participants"
  on public.conversation_participants for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
    )
  );

create policy "Users can add themselves as participants"
  on public.conversation_participants for insert to authenticated
  with check (true);

create policy "Users can update own read state"
  on public.conversation_participants for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Messages
create policy "Members can read channel messages"
  on public.messages for select to authenticated
  using (
    (
      channel_id is not null
      and exists (
        select 1 from public.channels c
        where c.id = channel_id
          and (
            not c.is_private
            or exists (
              select 1 from public.channel_members cm
              where cm.channel_id = c.id and cm.user_id = auth.uid()
            )
          )
      )
    )
    or (
      conversation_id is not null
      and exists (
        select 1 from public.conversation_participants cp
        where cp.conversation_id = conversation_id and cp.user_id = auth.uid()
      )
    )
  );

create policy "Authenticated users can send messages"
  on public.messages for insert to authenticated
  with check (sender_id = auth.uid());

create policy "Senders can edit own messages"
  on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- Reactions
create policy "Users can view reactions"
  on public.message_reactions for select to authenticated using (true);

create policy "Users can react"
  on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid());

create policy "Users can remove own reactions"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Notifications
create policy "Users can view own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Service role inserts notifications via webhook; allow insert for authenticated for client-side mention notifs
create policy "Authenticated can create notifications"
  on public.notifications for insert to authenticated
  with check (true);

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.profiles;
