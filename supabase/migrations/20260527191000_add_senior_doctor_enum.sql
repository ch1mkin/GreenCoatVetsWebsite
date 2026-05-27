do $$ begin
  alter type public.app_role add value if not exists 'senior_doctor';
exception
  when duplicate_object then null;
end $$;
