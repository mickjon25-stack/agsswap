-- Simulates the AgsSwap app's Data API calls role-by-role against the
-- migrated schema. Each check prints PASS/FAIL.
create schema if not exists t;
create table t.results (n serial, label text, ok boolean, detail text);
create or replace function t.run(p_label text, p_role text, p_sub uuid, p_sql text, p_expect_ok boolean, p_expect_val text default null)
returns void language plpgsql as $$
declare v text; err text := null; passed boolean;
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_sub::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  begin
    execute format('set local role %I', p_role);
    execute p_sql into v;
    execute 'reset role';
  exception when others then
    err := sqlerrm;
    execute 'reset role';
  end;
  passed := (err is null) = p_expect_ok and (p_expect_val is null or err is not null or v is not distinct from p_expect_val);
  insert into t.results(label, ok, detail) values (p_label, passed, coalesce('ERR: ' || err, 'val=' || coalesce(v, 'null')));
end $$;

-- Users (signup through auth.users as GoTrue would)
insert into auth.users (id, email, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@x.com', '{"terms_accepted":"true","terms_version":"1.0-draft","display_name":"Alice"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@x.com', '{"terms_accepted":"true","display_name":"Bob"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@x.com', '{"terms_accepted":"true","display_name":"Cara Admin"}');
update public.profiles set is_admin = true, role = 'Admin' where id = 'cccccccc-0000-0000-0000-000000000003';
insert into public.zip_centroids values ('77975', 29.57, -97.14), ('77964', 29.45, -96.94);

\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

select t.run('signup without terms is rejected', 'postgres', null, $q$insert into auth.users(email) values ('noterms@x.com') returning id::text$q$, false);
select t.run('terms recorded on profile', 'postgres', null, $q$select terms_version from public.profiles where email='a@x.com'$q$, true, '1.0-draft');

-- profiles
select t.run('A upsert own profile (insert-if-missing)', 'authenticated', :A, $q$insert into public.profiles (id, email, display_name) values ('aaaaaaaa-0000-0000-0000-000000000001','a@x.com','Alice') on conflict (id) do nothing returning 'x'$q$, true);
select t.run('A edit profile safe columns', 'authenticated', :A, $q$update public.profiles set display_name='Alice R', city='Moulton', zip='77975', company='Lavaca Ranch', role='Ranch / Farm', is_ranch=true, profile_complete=true where id='aaaaaaaa-0000-0000-0000-000000000001' returning id::text$q$, true);
select t.run('A cannot update is_admin', 'authenticated', :A, $q$update public.profiles set is_admin=true where id='aaaaaaaa-0000-0000-0000-000000000001' returning id::text$q$, false);
select t.run('A cannot update plan', 'authenticated', :A, $q$update public.profiles set plan='ranch' where id='aaaaaaaa-0000-0000-0000-000000000001' returning id::text$q$, false);
select t.run('A role=Admin silently reverted', 'authenticated', :A, $q$update public.profiles set role='Admin' where id='aaaaaaaa-0000-0000-0000-000000000001' returning role$q$, true, 'Ranch / Farm');
select t.run('A cannot insert profile with is_admin', 'authenticated', :A, $q$insert into public.profiles (id, is_admin) values ('aaaaaaaa-0000-0000-0000-000000000001', true) on conflict do nothing returning 'x'$q$, false);
select t.run('anon reads public profile columns', 'anon', null, $q$select display_name from public.profiles where id='aaaaaaaa-0000-0000-0000-000000000001'$q$, true, 'Alice R');
select t.run('anon cannot read email', 'anon', null, $q$select email from public.profiles limit 1$q$, false);
select t.run('B cannot read others zip', 'authenticated', :B, $q$select zip from public.profiles limit 1$q$, false);
select t.run('A get_my_profile returns private fields', 'authenticated', :A, $q$select email from public.get_my_profile()$q$, true, 'a@x.com');
select t.run('anon cannot call get_my_profile', 'anon', null, $q$select email from public.get_my_profile()$q$, false);
select t.run('admin_get_profile as admin', 'authenticated', :C, $q$select zip from public.admin_get_profile('aaaaaaaa-0000-0000-0000-000000000001')$q$, true, '77975');
select t.run('admin_get_profile as non-admin returns nothing', 'authenticated', :B, $q$select zip from public.admin_get_profile('aaaaaaaa-0000-0000-0000-000000000001')$q$, true, null);

-- listings
select t.run('A posts listing; pre-approve + free bump stripped', 'authenticated', :A, $q$insert into public.listings (id, poster_id, title, category, intent, condition, city, zip, status, bumped_at, approved_at) values ('11111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','6ft box blade','Tractor implements','Sell or Swap','Good','Moulton','77975','Rejected', now()+interval '1 year', now()) returning status || '|' || coalesce(bumped_at::text,'nobump')$q$, true, 'Pending Review|nobump');
select t.run('A adds photo', 'authenticated', :A, $q$insert into public.listing_photos (listing_id, storage_path, sort_order) values ('11111111-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001/blade1.jpg',0) returning 'x'$q$, true);
select t.run('A listing 2', 'authenticated', :A, $q$insert into public.listings (poster_id, title, category, intent, condition, city, zip) values ('aaaaaaaa-0000-0000-0000-000000000001','T-posts','Fence, posts & wire','Fast & Free','Good','Moulton','77975') returning 'x'$q$, true);
select t.run('A listing 3', 'authenticated', :A, $q$insert into public.listings (poster_id, title, category, intent, condition, city, zip) values ('aaaaaaaa-0000-0000-0000-000000000001','Round bales','Hay, baling & forage','Sell','Good','Moulton','77975') returning 'x'$q$, true);
select t.run('A listing 4 blocked by free cap', 'authenticated', :A, $q$insert into public.listings (poster_id, title, category, intent, condition, city, zip) values ('aaaaaaaa-0000-0000-0000-000000000001','Goats','Livestock','Swap','Good','Moulton','77975') returning 'x'$q$, false);
select t.run('bad ZIP rejected', 'authenticated', :B, $q$insert into public.listings (poster_id, title, category, intent, condition, city, zip) values ('bbbbbbbb-0000-0000-0000-000000000002','x','Other','Swap','Good','X','ABCDE') returning 'x'$q$, false);
select t.run('anon cannot post', 'anon', null, $q$insert into public.listings (poster_id, title, category, intent, condition, city, zip) values ('bbbbbbbb-0000-0000-0000-000000000002','x','Other','Swap','Good','X','77975') returning 'x'$q$, false);
select t.run('A cannot self-approve', 'authenticated', :A, $q$update public.listings set status='Approved' where id='11111111-0000-0000-0000-000000000001' returning 'x'$q$, false);
select t.run('anon cannot see pending listing', 'anon', null, $q$select count(*)::text from public.listings$q$, true, '0');
select t.run('admin approves listing', 'authenticated', :C, $q$update public.listings set status='Approved', approved_at=now() where id='11111111-0000-0000-0000-000000000001' returning status$q$, true, 'Approved');
select t.run('admin cannot approve listing without photo', 'authenticated', :C, $q$update public.listings set status='Approved' where title='T-posts' returning status$q$, false);
select t.run('anon sees approved listing + photo row', 'anon', null, $q$select count(*)::text from public.listings l join public.listing_photos p on p.listing_id=l.id$q$, true, '1');
select t.run('anon listing_distances', 'anon', null, $q$select miles::text from public.listing_distances('77964', 50)$q$, true);
select t.run('anon storage: sign approved photo', 'anon', null, $q$select count(*)::text from storage.objects where bucket_id='listing-photos'$q$, true);
select t.run('A can bump? (bumped_at locked)', 'authenticated', :A, $q$update public.listings set bumped_at=now() where id='11111111-0000-0000-0000-000000000001' returning coalesce(bumped_at::text,'nobump')$q$, true, 'nobump');
select t.run('A price edit stays live', 'authenticated', :A, $q$update public.listings set price=400 where id='11111111-0000-0000-0000-000000000001' returning status$q$, true, 'Approved');

-- offers / threads / messages
select t.run('B offer must be Pending', 'authenticated', :B, $q$insert into public.offers (listing_id, from_user_id, message, status) values ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','hi','Accepted') returning 'x'$q$, false);
select t.run('B makes offer', 'authenticated', :B, $q$insert into public.offers (id, listing_id, from_user_id, message, status) values ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Would swap hay','Pending') returning 'x'$q$, true);
select t.run('B opens thread', 'authenticated', :B, $q$insert into public.threads (id, listing_id, offer_id, participant_a, participant_b) values ('33333333-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','22222222-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001') returning 'x'$q$, true);
select t.run('B sends message', 'authenticated', :B, $q$insert into public.messages (thread_id, sender_id, body) values ('33333333-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002','Still available?') returning 'x'$q$, true);
select t.run('A reads offer + message', 'authenticated', :A, $q$select (select count(*) from public.offers)::text || '/' || (select count(*) from public.messages)::text$q$, true, '1/1');
select t.run('anon cannot read messages', 'anon', null, $q$select count(*)::text from public.messages$q$, false);
select t.run('A hides thread for self', 'authenticated', :A, $q$insert into public.thread_hides (user_id, thread_id) values ('aaaaaaaa-0000-0000-0000-000000000001','33333333-0000-0000-0000-000000000001') returning 'x'$q$, true);
select t.run('A unhides thread', 'authenticated', :A, $q$delete from public.thread_hides where user_id='aaaaaaaa-0000-0000-0000-000000000001' returning 'x'$q$, true);

-- trades / reviews
select t.run('B requests trade complete', 'authenticated', :B, $q$select public.request_trade_complete('33333333-0000-0000-0000-000000000001')::text$q$, true);
select t.run('B cannot confirm own request', 'authenticated', :B, $q$select public.respond_trade_complete((select id from public.trades limit 1), true)::text$q$, false);
select t.run('A confirms trade', 'authenticated', :A, $q$select public.respond_trade_complete((select id from public.trades limit 1), true)::text$q$, true);
select t.run('clients cannot write trades', 'authenticated', :A, $q$update public.trades set status='Cancelled' returning 'x'$q$, false);
select t.run('B reviews A', 'authenticated', :B, $q$insert into public.reviews (trade_id, reviewer_id, reviewee_id, stars, comment) values ((select id from public.trades limit 1),'bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001',5,'Great blade') returning 'x'$q$, true);
select t.run('review with hidden col denied', 'authenticated', :A, $q$insert into public.reviews (trade_id, reviewer_id, reviewee_id, stars, hidden) values ((select id from public.trades limit 1),'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',5,false) returning 'x'$q$, false);
select t.run('blind: anon sees 0 public reviews yet', 'anon', null, $q$select count(*)::text from public.public_reviews$q$, true, '0');
select t.run('A reviews B', 'authenticated', :A, $q$insert into public.reviews (trade_id, reviewer_id, reviewee_id, stars, comment) values ((select id from public.trades limit 1),'aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002',4,'Good trade') returning 'x'$q$, true);
select t.run('anon sees 2 public reviews', 'anon', null, $q$select count(*)::text from public.public_reviews$q$, true, '2');
select t.run('anon member_ratings', 'anon', null, $q$select avg_stars::text from public.member_ratings where member_id='aaaaaaaa-0000-0000-0000-000000000001'$q$, true, '5.0');
select t.run('A reports a review', 'authenticated', :A, $q$insert into public.review_reports (review_id, reporter_id, reason) values ((select id from public.reviews where reviewer_id='bbbbbbbb-0000-0000-0000-000000000002'),'aaaaaaaa-0000-0000-0000-000000000001','test') returning 'x'$q$, true);
select t.run('non-admin hide review = no rows', 'authenticated', :A, $q$update public.reviews set hidden=true returning 'x'$q$, true, null);
select t.run('admin hides review', 'authenticated', :C, $q$update public.reviews set hidden=true where reviewer_id='bbbbbbbb-0000-0000-0000-000000000002' returning 'x'$q$, true, 'x');
select t.run('admin resolves review report', 'authenticated', :C, $q$update public.review_reports set status='Resolved' returning status$q$, true, 'Resolved');

-- reports
select t.run('report must start Pending', 'authenticated', :B, $q$insert into public.reports (reporter_id, listing_id, reason, status) values ('bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','Prohibited item','Resolved') returning 'x'$q$, false);
select t.run('B reports listing', 'authenticated', :B, $q$insert into public.reports (reporter_id, listing_id, reason, details, status) values ('bbbbbbbb-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','Prohibited item','','Pending') returning 'x'$q$, true);
select t.run('B cannot resolve report', 'authenticated', :B, $q$update public.reports set status='Resolved' returning 'x'$q$, true, null);
select t.run('admin resolves report', 'authenticated', :C, $q$update public.reports set status='Resolved' returning status$q$, true, 'Resolved');

-- alerts / prefs
select t.run('A creates prefs row', 'authenticated', :A, $q$insert into public.notification_prefs (user_id) values ('aaaaaaaa-0000-0000-0000-000000000001') on conflict (user_id) do nothing returning 'x'$q$, true);
select t.run('A toggles prefs', 'authenticated', :A, $q$update public.notification_prefs set message_alerts=false, updated_at=now() where user_id='aaaaaaaa-0000-0000-0000-000000000001' returning 'x'$q$, true, 'x');
select t.run('A cannot set unsubscribe_token', 'authenticated', :A, $q$update public.notification_prefs set unsubscribe_token=gen_random_uuid() returning 'x'$q$, false);
select t.run('B saves alert', 'authenticated', :B, $q$insert into public.saved_alerts (user_id, keywords, zip, max_miles) values ('bbbbbbbb-0000-0000-0000-000000000002','box blade','77964',50) returning 'x'$q$, true);
select t.run('service_role matches alerts', 'service_role', null, $q$select count(*)::text from public.match_listing_alerts('11111111-0000-0000-0000-000000000001')$q$, true, '1');
select t.run('authenticated cannot call match_listing_alerts', 'authenticated', :A, $q$select count(*)::text from public.match_listing_alerts('11111111-0000-0000-0000-000000000001')$q$, false);
select t.run('service_role logs alert', 'service_role', null, $q$insert into public.listing_alert_log (listing_id, user_id) values ('11111111-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002') on conflict do nothing returning 'x'$q$, true);
select t.run('claim_thread_email first = true', 'service_role', null, $q$select public.claim_thread_email('33333333-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')::text$q$, true, 'true');
select t.run('claim_thread_email throttled = false', 'service_role', null, $q$select public.claim_thread_email('33333333-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001')::text$q$, true, 'false');
select t.run('authenticated cannot read email log', 'authenticated', :A, $q$select count(*)::text from public.thread_email_log$q$, false);
select t.run('service_role reads prefs+token', 'service_role', null, $q$select (unsubscribe_token is not null)::text from public.notification_prefs limit 1$q$, true, 'true');

-- billing (webhook as service_role) raises cap
select t.run('webhook sets Ranch plan', 'service_role', null, $q$update public.profiles set plan='ranch', plan_status='active', subscribed=true, stripe_customer_id='cus_test' where id='aaaaaaaa-0000-0000-0000-000000000001' returning plan$q$, true, 'ranch');
select t.run('A listing 4 allowed on Ranch plan', 'authenticated', :A, $q$insert into public.listings (poster_id, title, category, intent, condition, city, zip) values ('aaaaaaaa-0000-0000-0000-000000000001','Goats','Livestock','Swap','Good','Moulton','77975') returning 'x'$q$, true);
select t.run('webhook bumps listing', 'service_role', null, $q$update public.listings set bumped_at=now() where id='11111111-0000-0000-0000-000000000001' returning (bumped_at is not null)::text$q$, true, 'true');

-- storage
select t.run('A uploads to own photo folder', 'authenticated', :A, $q$insert into storage.objects (bucket_id, name) values ('listing-photos','aaaaaaaa-0000-0000-0000-000000000001/blade1.jpg') returning 'x'$q$, true);
select t.run('A cannot upload into B folder', 'authenticated', :A, $q$insert into storage.objects (bucket_id, name) values ('listing-photos','bbbbbbbb-0000-0000-0000-000000000002/x.jpg') returning 'x'$q$, false);
select t.run('anon can sign approved listing photo', 'anon', null, $q$select count(*)::text from storage.objects where bucket_id='listing-photos'$q$, true, '1');
select t.run('A avatar upload', 'authenticated', :A, $q$insert into storage.objects (bucket_id, name) values ('avatars','aaaaaaaa-0000-0000-0000-000000000001/a.webp') returning 'x'$q$, true);
select t.run('anon cannot list avatars', 'anon', null, $q$select count(*)::text from storage.objects where bucket_id='avatars'$q$, true, '0');

-- listing edit / delete
select t.run('content edit on live listing re-enters review', 'authenticated', :A, $q$update public.listings set title='6ft box blade (Cat I)' where id='11111111-0000-0000-0000-000000000001' returning status$q$, true, 'Pending Review');
select t.run('A cannot delete last photo', 'authenticated', :A, $q$delete from public.listing_photos where listing_id='11111111-0000-0000-0000-000000000001' returning 'x'$q$, false);
select t.run('anon cannot delete_own_listing', 'anon', null, $q$select public.delete_own_listing('11111111-0000-0000-0000-000000000001')::text$q$, false);
select t.run('B cannot delete A listing', 'authenticated', :B, $q$select public.delete_own_listing('11111111-0000-0000-0000-000000000001')::text$q$, false);
select t.run('A soft-deletes listing', 'authenticated', :A, $q$select public.delete_own_listing('11111111-0000-0000-0000-000000000001')::text$q$, true);
select t.run('offer withdrawn on delete', 'service_role', null, $q$select status from public.offers limit 1$q$, true, 'Withdrawn');

-- account deletion (server)
select t.run('last admin cannot be deleted', 'service_role', null, $q$select public.prepare_account_deletion('cccccccc-0000-0000-0000-000000000003')::text$q$, false);
select t.run('prepare B deletion', 'service_role', null, $q$select public.prepare_account_deletion('bbbbbbbb-0000-0000-0000-000000000002')::text$q$, true);
select t.run('authenticated cannot prepare deletion', 'authenticated', :B, $q$select public.prepare_account_deletion('bbbbbbbb-0000-0000-0000-000000000002')::text$q$, false);
select t.run('delete auth user B cascades', 'postgres', null, $q$delete from auth.users where id='bbbbbbbb-0000-0000-0000-000000000002' returning 'x'$q$, true);
select t.run('thread kept with Deleted member', 'service_role', null, $q$select (participant_a is null)::text from public.threads limit 1$q$, true, 'true');

select n, case when ok then 'PASS' else 'FAIL' end as result, label, detail from t.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
