#!/usr/bin/env bash
# Provisions the household and six roommates on the linked Supabase project.
# Every roommate gets their OWN random 6-digit code (never shared). New codes are printed once.
#   ./scripts/seed.sh                      creates anything missing; existing codes are left alone
#   RESET_PINS=Jesse,Kelly ./scripts/seed.sh   issues fresh codes for just those people (and signs them out)
set -euo pipefail
cd "$(dirname "$0")/.."

sql=$(mktemp)
trap 'rm -f "$sql"' EXIT

RESET=",${RESET_PINS:-},"
used=" "
rows=""
for entry in Jay:member Micah:member Tyler:member Ayush:admin Jesse:member Kelly:member; do
  name=${entry%%:*}; role=${entry##*:}
  while :; do
    pin=$(printf '%06d' $(( $(od -An -N4 -tu4 /dev/urandom) % 1000000 )))
    [[ "$used" == *" $pin "* ]] || break
  done
  used+="$pin "
  reset=false; [[ "$RESET" == *",$name,"* ]] && reset=true
  rows+="('$name','$role','$pin',$reset),"
  echo "$name  $pin" >> "$sql.pins"
done

cat > "$sql" <<SQL
do \$\$
declare r record; uid uuid; hid uuid := 'a1b2c3d4-0000-4000-8000-000000000001'; mail text;
begin
  insert into public.households (id, name, timezone) values (hid, 'Abingdon Bros', 'America/New_York')
  on conflict do nothing;
  insert into public.dishes (household_id, name)
  select hid, d from unnest(array['Tacos','Chicken tikka masala','Pad thai','Smash burgers','Pasta carbonara','Fried rice','Enchiladas','Ramen']) d
  on conflict do nothing;
  for r in select * from (values ${rows%,}) v(name, role, pin, reset) loop
    mail := lower(r.name) || '@abingdon.example.com';
    select id into uid from auth.users where email = mail;
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
        extensions.crypt(r.pin, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), uid, uid::text,
        jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
      raise notice 'NEWPIN % %', r.name, r.pin;
    elsif r.reset then
      update auth.users set encrypted_password = extensions.crypt(r.pin, extensions.gen_salt('bf')) where id = uid;
      delete from auth.sessions where user_id = uid;
      raise notice 'NEWPIN % %', r.name, r.pin;
    end if;
    update public.profiles set display_name = r.name where id = uid;
    insert into public.household_members (household_id, user_id, role) values (hid, uid, r.role)
    on conflict do nothing;
  end loop;
end \$\$;
SQL
rm -f "$sql.pins"
# NOTICE lines carry the new codes; everything else is silenced.
supabase db query --linked -f "$sql" 2>&1 | grep -oE 'NEWPIN [A-Za-z]+ [0-9]{6}' | sed 's/NEWPIN //' || true
echo "done"
