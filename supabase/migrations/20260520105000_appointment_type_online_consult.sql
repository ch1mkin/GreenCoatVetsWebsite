do $$ begin
  alter type public.appointment_type add value if not exists 'online_consult';
exception when duplicate_object then null;
end $$;
