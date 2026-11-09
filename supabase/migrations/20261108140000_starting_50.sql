-- Starting balance is 50 bingdons. 'adjustment' lets the append-only ledger carry corrections.
alter table public.households alter column starting_balance set default 50;
update public.households set starting_balance = 50;

alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in ('starting', 'daily', 'tip_out', 'tip_in', 'game', 'poll', 'adjustment'));
