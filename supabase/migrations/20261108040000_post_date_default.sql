-- The BEFORE INSERT trigger always overwrites local_date; the default just makes it optional for clients.
alter table public.daily_posts alter column local_date set default current_date;
