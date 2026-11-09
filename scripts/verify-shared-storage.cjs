#!/usr/bin/env node
'use strict';

// A disposable PostgreSQL instance only. No URL, token, environment credential,
// network client or filesystem database is used by this harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const migrationPath = process.argv[2];
if (!migrationPath || /^[a-z]+:\/\//i.test(migrationPath)) {
  console.error('Usage: node verify-shared-storage.cjs /local/path/to/migration.sql');
  process.exit(2);
}
// Exact authorized catalog snapshots, containing definitions only; no production rows.
// Only policies relevant to the three fixture buckets and their referenced tables are included.
const fixture = {
  "capturedAt": "2026-11-09",
  "primitives": [
    {
      "anon_execute": true,
      "authenticated_execute": true,
      "definition": "CREATE OR REPLACE FUNCTION auth.uid()\n RETURNS uuid\n LANGUAGE sql\n STABLE\nAS $function$\n  select \n  coalesce(\n    nullif(current_setting('request.jwt.claim.sub', true), ''),\n    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')\n  )::uuid\n$function$\n",
      "schema": "auth",
      "signature": "auth.uid()"
    },
    {
      "anon_execute": true,
      "authenticated_execute": true,
      "definition": "CREATE OR REPLACE FUNCTION storage.filename(name text)\n RETURNS text\n LANGUAGE plpgsql\n IMMUTABLE\nAS $function$\nDECLARE\n    _parts text[];\nBEGIN\n    SELECT string_to_array(name, '/') INTO _parts;\n    RETURN _parts[array_length(_parts, 1)];\nEND\n$function$\n",
      "schema": "storage",
      "signature": "storage.filename(text)"
    },
    {
      "anon_execute": true,
      "authenticated_execute": true,
      "definition": "CREATE OR REPLACE FUNCTION storage.foldername(name text)\n RETURNS text[]\n LANGUAGE plpgsql\n IMMUTABLE\nAS $function$\nDECLARE\n    _parts text[];\nBEGIN\n    -- Split on \"/\" to get path segments\n    SELECT string_to_array(name, '/') INTO _parts;\n    -- Return everything except the last segment\n    RETURN _parts[1 : array_length(_parts,1) - 1];\nEND\n$function$\n",
      "schema": "storage",
      "signature": "storage.foldername(text)"
    }
  ],
  "helpers": [
    {
      "definition": "CREATE OR REPLACE FUNCTION public.contact_account_active()\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO ''\nAS $function$ SELECT NOT EXISTS(SELECT 1 FROM public.account_access_revocations WHERE user_id=auth.uid()) $function$\n",
      "signature": "contact_account_active()"
    },
    {
      "definition": "CREATE OR REPLACE FUNCTION public.get_agenda_share(_code text)\n RETURNS TABLE(id uuid, title text, event_date date, start_time time without time zone, end_time time without time zone, location text, event_type text, image_path text, cancelled_at timestamp with time zone, cancel_reason text)\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT e.id, e.title, e.event_date, e.start_time, e.end_time, e.location, e.event_type::text,\n         e.image_path, e.cancelled_at, e.cancel_reason\n  FROM public.agenda_events e\n  WHERE upper(e.share_code) = upper(_code)\n  LIMIT 1\n$function$\n",
      "signature": "get_agenda_share(text)"
    },
    {
      "definition": "CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT EXISTS (\n    SELECT 1\n    FROM public.user_roles\n    WHERE user_id = _user_id\n      AND role = _role\n  )\n$function$\n",
      "signature": "has_role(uuid,app_role)"
    },
    {
      "definition": "CREATE OR REPLACE FUNCTION public.is_board_member(_user_id uuid)\n RETURNS boolean\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT EXISTS (\n    SELECT 1\n    FROM public.board_members bm\n    JOIN public.member_profiles mp ON mp.user_id = _user_id\n    WHERE bm.lid_id = mp.member_id\n       OR mp.member_id = ANY(COALESCE(bm.lid_ids, '{}'::integer[]))\n  )\n$function$\n",
      "signature": "is_board_member(uuid)"
    },
    {
      "definition": "CREATE OR REPLACE FUNCTION public.support_my_member_id()\n RETURNS integer\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT public.support_member_id(auth.uid())\n$function$\n",
      "signature": "support_my_member_id()"
    },
    {
      "definition": "CREATE OR REPLACE FUNCTION public.support_member_id(_uid uuid)\n RETURNS integer\n LANGUAGE sql\n STABLE SECURITY DEFINER\n SET search_path TO 'public'\nAS $function$\n  SELECT min(mp.member_id) FROM public.member_profiles mp\n  JOIN public.members_data md ON md.id = mp.member_id AND md.member_type IN ('member','lead')\n  WHERE _uid IS NOT NULL AND mp.user_id = _uid\n    AND NOT public.has_role(_uid, 'extern') AND NOT public.has_role(_uid, 'inhuur')\n$function$\n",
      "name": "support_member_id(uuid)"
    }
  ],
  "storagePolicies": [
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can delete agenda images",
      "qual": "((bucket_id = 'agenda-images'::text) AND has_role(auth.uid(), 'admin'::app_role))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can update agenda images",
      "qual": "((bucket_id = 'agenda-images'::text) AND has_role(auth.uid(), 'admin'::app_role))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can upload agenda images",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": "((bucket_id = 'agenda-images'::text) AND has_role(auth.uid(), 'admin'::app_role))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Authenticated can view agenda images",
      "qual": "(bucket_id = 'agenda-images'::text)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "contact photos readable by board or own member",
      "qual": "((bucket_id = 'contact-photos'::text) AND (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()) OR (EXISTS ( SELECT 1\n   FROM member_profiles mp\n  WHERE ((mp.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] ~ '^[0-9]+$'::text) AND (mp.member_id = ((storage.foldername(objects.name))[1])::integer))))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    },
    {
      "cmd": "ALL",
      "permissive": "RESTRICTIVE",
      "policyname": "contact_account_not_revoked",
      "qual": "contact_account_active()",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": "contact_account_active()"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "member logos readable by authenticated",
      "qual": "(bucket_id = 'member-logos'::text)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    },
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "member media delete",
      "qual": "((bucket_id = ANY (ARRAY['contact-photos'::text, 'member-logos'::text])) AND (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()) OR (EXISTS ( SELECT 1\n   FROM member_profiles mp\n  WHERE ((mp.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] ~ '^[0-9]+$'::text) AND (mp.member_id = ((storage.foldername(objects.name))[1])::integer))))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "member media insert",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": "((bucket_id = ANY (ARRAY['contact-photos'::text, 'member-logos'::text])) AND (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()) OR (EXISTS ( SELECT 1\n   FROM member_profiles mp\n  WHERE ((mp.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] ~ '^[0-9]+$'::text) AND (mp.member_id = ((storage.foldername(objects.name))[1])::integer))))))"
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "member media update",
      "qual": "((bucket_id = ANY (ARRAY['contact-photos'::text, 'member-logos'::text])) AND (has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()) OR (EXISTS ( SELECT 1\n   FROM member_profiles mp\n  WHERE ((mp.user_id = auth.uid()) AND ((storage.foldername(objects.name))[1] ~ '^[0-9]+$'::text) AND (mp.member_id = ((storage.foldername(objects.name))[1])::integer))))))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "storage",
      "tablename": "objects",
      "with_check": null
    }
  ],
  "tablePolicies": [
    {
      "cmd": "ALL",
      "permissive": "PERMISSIVE",
      "policyname": "Admins beheren agenda-items",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "agenda_events",
      "with_check": "has_role(auth.uid(), 'admin'::app_role)"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Leden zien gepubliceerde agenda-items",
      "qual": "(is_published OR has_role(auth.uid(), 'admin'::app_role))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "agenda_events",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can read all profiles",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "member_profiles",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "Users can link own verified member",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "member_profiles",
      "with_check": "((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR (EXISTS ( SELECT 1\n   FROM (member_allowed_emails mae\n     JOIN auth.users u ON ((u.id = auth.uid())))\n  WHERE ((mae.member_id = member_profiles.member_id) AND (mae.email = lower(TRIM(BOTH FROM u.email))))))))"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Users can read own profile",
      "qual": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "member_profiles",
      "with_check": null
    },
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can delete roles",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "user_roles",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can insert roles",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "user_roles",
      "with_check": "has_role(auth.uid(), 'admin'::app_role)"
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can update roles",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "user_roles",
      "with_check": "has_role(auth.uid(), 'admin'::app_role)"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can view all roles",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "user_roles",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Users can read own roles",
      "qual": "(user_id = auth.uid())",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "user_roles",
      "with_check": null
    },
    {
      "cmd": "DELETE",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can delete members_data",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": null
    },
    {
      "cmd": "INSERT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can insert members_data",
      "qual": null,
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": "has_role(auth.uid(), 'admin'::app_role)"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can read all members_data",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": null
    },
    {
      "cmd": "UPDATE",
      "permissive": "PERMISSIVE",
      "policyname": "Admins can update members_data",
      "qual": "has_role(auth.uid(), 'admin'::app_role)",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": "has_role(auth.uid(), 'admin'::app_role)"
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Board members can read all members_data",
      "qual": "is_board_member(( SELECT auth.uid() AS uid))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "RESTRICTIVE",
      "policyname": "Leads restricted to internal readers",
      "qual": "((member_type <> 'lead'::text) OR has_role(auth.uid(), 'admin'::app_role) OR is_board_member(auth.uid()) OR has_role(auth.uid(), 'inhuur'::app_role))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": null
    },
    {
      "cmd": "SELECT",
      "permissive": "PERMISSIVE",
      "policyname": "Users can read own member_data",
      "qual": "(id IN ( SELECT member_profiles.member_id\n   FROM member_profiles\n  WHERE (member_profiles.user_id = auth.uid())))",
      "roles": [
        "authenticated"
      ],
      "schemaname": "public",
      "tablename": "members_data",
      "with_check": null
    }
  ]
};
const primitives = fixture.primitives;
const migration = fs.readFileSync(path.resolve(migrationPath), 'utf8');
const db = new PGlite();
let checks = 0;
const qid = value => '"' + String(value).replaceAll('"', '""') + '"';
const equal = (actual, expected, label) => {
  assert.deepStrictEqual(actual, expected, label);
  checks++;
};
const uuid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const actors = {
  admin: { uid: uuid(1), role: 'authenticated' },
  board: { uid: uuid(2), role: 'authenticated' },
  member: { uid: uuid(3), role: 'authenticated' },
  lead: { uid: uuid(4), role: 'authenticated' },
  extern: { uid: uuid(5), role: 'authenticated' },
  inhuur: { uid: uuid(6), role: 'authenticated' },
  unlinkedUser: { uid: uuid(7), role: 'authenticated' },
  unlinkedNoRole: { uid: uuid(8), role: 'authenticated' },
  revokedAdmin: { uid: uuid(9), role: 'authenticated' },
  oldMember: { uid: uuid(10), role: 'authenticated' },
  missingMember: { uid: uuid(11), role: 'authenticated' },
  anon: { uid: null, role: 'anon' },
};
const sorted = values => [...values].sort();
const agendaNames = ['draft.png', 'orphan.png', 'published.png'];
const validLogoNames = ['101/logo.png', '202/logo.jpg', '303/logo.png', '404/logo.webp', '505/logo.png', '606/logo.png', '707/logo.png'];
const invalidLogoNames = ['logo.png', '101/private.pdf', '101/nested/logo.png', 'not-a-number/logo.png', '101/Logo.png'];
const allLogoNames = sorted([...validLogoNames, ...invalidLogoNames]);
const photoNames = ['101/person.jpg', '202/person.jpg', '303/person.jpg', '404/person.jpg', '505/person.jpg', '606/person.jpg', '707/person.jpg'];

async function asActor(name, fn) {
  const actor = actors[name];
  assert.ok(actor, 'Unknown fixture actor');
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${qid(actor.role)}`);
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)", [actor.uid || '', JSON.stringify(actor.uid ? { sub: actor.uid, role: actor.role } : { role: actor.role })]);
    const identity = await db.query('SELECT current_user AS role, auth.uid()::text AS uid');
    equal(identity.rows[0], { role: actor.role, uid: actor.uid }, `${name}: real role and JWT identity`);
    return await fn();
  } finally {
    await db.exec('ROLLBACK');
  }
}

async function names(bucket) {
  const result = await db.query('SELECT name FROM storage.objects WHERE bucket_id = $1 ORDER BY name', [bucket]);
  return result.rows.map(row => row.name);
}

async function denied(sql, params, label) {
  await db.exec('SAVEPOINT expected_denial');
  let error;
  try { await db.query(sql, params); } catch (caught) { error = caught; }
  await db.exec('ROLLBACK TO SAVEPOINT expected_denial');
  await db.exec('RELEASE SAVEPOINT expected_denial');
  equal(error?.code, '42501', label);
}

function policySql(policy) {
  assert.ok(['ALL', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'].includes(policy.cmd));
  assert.ok(['PERMISSIVE', 'RESTRICTIVE'].includes(policy.permissive));
  let sql = `CREATE POLICY ${qid(policy.policyname)} ON ${qid(policy.schemaname)}.${qid(policy.tablename)} AS ${policy.permissive} FOR ${policy.cmd} TO ${policy.roles.map(role => role === 'public' ? 'PUBLIC' : qid(role)).join(', ')}`;
  if (policy.qual != null) sql += ` USING (${policy.qual})`;
  if (policy.with_check != null) sql += ` WITH CHECK (${policy.with_check})`;
  return sql + ';';
}

async function setup() {
  await db.exec(`
    CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE anon NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE SCHEMA storage;
    CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'extern', 'inhuur');
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE TABLE public.user_roles (user_id uuid, role public.app_role, PRIMARY KEY(user_id, role));
    CREATE TABLE public.members_data (id integer PRIMARY KEY, member_type text, data jsonb DEFAULT '{}');
    CREATE TABLE public.member_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, member_id integer);
    CREATE TABLE public.member_allowed_emails (member_id integer, email text);
    CREATE TABLE public.board_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lid_id integer, lid_ids integer[]);
    CREATE TABLE public.account_access_revocations (user_id uuid PRIMARY KEY);
    CREATE TABLE public.agenda_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), image_path text, is_published boolean,
      title text, event_date date, start_time time, end_time time, location text,
      event_type text, share_code text, cancelled_at timestamptz, cancel_reason text
    );
    CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean);
    CREATE TABLE storage.objects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text,
      owner uuid, owner_id text, metadata jsonb DEFAULT '{}', UNIQUE(bucket_id, name)
    );
    GRANT USAGE ON SCHEMA public, auth, storage TO authenticated, anon;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, anon;
    GRANT SELECT ON public.agenda_events, public.member_profiles, public.user_roles, public.members_data TO authenticated;
  `);
  // auth.uid and Storage path primitives are exact live pg_get_functiondef snapshots.
  for (const primitive of primitives) {
    await db.exec(primitive.definition);
    await db.exec(`REVOKE ALL ON FUNCTION ${primitive.signature} FROM PUBLIC`);
    if (primitive.anon_execute) await db.exec(`GRANT EXECUTE ON FUNCTION ${primitive.signature} TO anon`);
    if (primitive.authenticated_execute) await db.exec(`GRANT EXECUTE ON FUNCTION ${primitive.signature} TO authenticated`);
  }
  const helpers = fixture.helpers;
  const byName = new Map(helpers.map(helper => [helper.definition.match(/FUNCTION\s+public\.([a-z_]+)/i)?.[1], helper.definition]));
  for (const name of ['has_role', 'is_board_member', 'contact_account_active', 'support_member_id', 'support_my_member_id', 'get_agenda_share']) {
    assert.ok(byName.has(name), `Missing live helper ${name}`);
    await db.exec(byName.get(name));
  }
  await db.exec(`
    REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role), public.is_board_member(uuid),
      public.contact_account_active(), public.support_my_member_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.get_agenda_share(text) TO authenticated, anon, service_role;
  `);

  for (const actor of Object.values(actors)) if (actor.uid) {
    await db.query('INSERT INTO auth.users(id, email) VALUES ($1, $2)', [actor.uid, `synthetic-${actor.uid.slice(-2)}@example.invalid`]);
  }
  for (const [name, role] of Object.entries({ admin: 'admin', board: 'user', member: 'user', lead: 'user', extern: 'extern', inhuur: 'inhuur', unlinkedUser: 'user', revokedAdmin: 'admin', oldMember: 'user', missingMember: 'user' })) {
    await db.query('INSERT INTO public.user_roles VALUES ($1, $2)', [actors[name].uid, role]);
  }
  for (const [id, type] of [[101, 'member'], [202, 'member'], [303, 'member'], [404, 'lead'], [505, 'member'], [606, 'member'], [707, 'old']]) {
    await db.query('INSERT INTO public.members_data(id, member_type) VALUES ($1,$2)', [id, type]);
  }
  for (const [name, id] of Object.entries({ member: 101, board: 303, lead: 404, extern: 505, inhuur: 606, oldMember: 707, missingMember: 808 })) {
    await db.query('INSERT INTO public.member_profiles(user_id, member_id) VALUES ($1,$2)', [actors[name].uid, id]);
  }
  await db.exec("INSERT INTO public.board_members(lid_id,lid_ids) VALUES (NULL,ARRAY[303]); INSERT INTO storage.buckets VALUES ('agenda-images','agenda-images',false),('member-logos','member-logos',false),('contact-photos','contact-photos',false)");
  await db.query('INSERT INTO public.account_access_revocations VALUES ($1)', [actors.revokedAdmin.uid]);
  await db.exec("INSERT INTO public.agenda_events(image_path,is_published,title,event_date,event_type,share_code) VALUES ('published.png',true,'SYNTH published',DATE '2030-01-01','evenement','SYNTHP'),('draft.png',false,'SYNTH draft',DATE '2030-01-02','evenement','SYNTHD')");
  for (const [bucket, values] of [['agenda-images', agendaNames], ['member-logos', allLogoNames], ['contact-photos', photoNames]]) {
    for (const name of values) await db.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)', [bucket, name]);
  }

  const storagePolicies = fixture.storagePolicies;
  for (const table of ['storage.objects', 'public.agenda_events', 'public.member_profiles', 'public.user_roles', 'public.members_data']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
  const policies = [...storagePolicies, ...fixture.tablePolicies];
  for (const policy of policies) await db.exec(policySql(policy));
  return storagePolicies.length;
}

async function main() {
  const storagePolicyCount = await setup();
  const baselinePhotos = {};
  let beforeCounts;
  await asActor('unlinkedUser', async () => {
    const agenda = await names('agenda-images');
    const logos = await names('member-logos');
    equal(agenda, sorted(agendaNames), 'before: unlinked user reads every agenda image');
    equal(logos, allLogoNames, 'before: unlinked user reads every logo-bucket object');
    beforeCounts = { agenda: agenda.length, logos: logos.length };
  });
  for (const name of Object.keys(actors)) baselinePhotos[name] = await asActor(name, () => names('contact-photos'));
  const policiesBefore = (await db.query("SELECT policyname, cmd, roles, permissive, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname")).rows;
  const publicShareBefore = (await db.query("SELECT pg_get_functiondef('public.get_agenda_share(text)'::regprocedure) AS definition")).rows[0].definition;
  console.log(JSON.stringify({ stage: 'before', reproducedUnlinkedAccess: beforeCounts, storagePolicies: storagePolicyCount }));

  await db.exec(migration);

  const policiesAfter = (await db.query("SELECT policyname, cmd, roles, permissive, qual, with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname")).rows;
  const changedNames = new Set(['Authenticated can view agenda images', 'member logos readable by authenticated']);
  equal(policiesAfter.length, policiesBefore.length, 'no policies removed or added');
  equal(policiesAfter.filter(p => !changedNames.has(p.policyname)), policiesBefore.filter(p => !changedNames.has(p.policyname)), 'all other Storage policies unchanged');
  equal((await db.query("SELECT pg_get_functiondef('public.get_agenda_share(text)'::regprocedure) AS definition")).rows[0].definition, publicShareBefore, 'public sharing function unchanged');
  equal((await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass")).rows[0].relrowsecurity, true, 'Storage RLS remains enabled');

  for (const name of Object.keys(actors)) await asActor(name, async () => {
    const privileged = name === 'admin' || name === 'board';
    const linked = name === 'member' || name === 'lead';
    const expectedAgenda = name === 'admin' ? sorted(agendaNames) : privileged || linked ? ['published.png'] : [];
    const expectedLogos = privileged ? allLogoNames : linked ? sorted(validLogoNames) : [];
    equal(await names('agenda-images'), expectedAgenda, `${name}: agenda visibility`);
    equal(await names('member-logos'), expectedLogos, `${name}: logo visibility and malformed paths`);
    equal(await names('contact-photos'), baselinePhotos[name], `${name}: original contact-photo boundary unchanged`);
    const helper = name === 'anon' ? null : (await db.query('SELECT public.support_my_member_id() AS id')).rows[0].id;
    if (name === 'member') equal(helper, 101, 'member helper is real profile-backed implementation');
    if (name === 'lead') equal(helper, 404, 'lead preserved by existing helper contract');
    if (['extern','inhuur','unlinkedUser','unlinkedNoRole','oldMember','missingMember'].includes(name)) equal(helper, null, `${name}: no qualifying member link`);
    if (linked) {
      const folders = (await db.query("SELECT DISTINCT (storage.foldername(name))[1] AS folder FROM storage.objects WHERE bucket_id='member-logos' ORDER BY folder")).rows.map(row => row.folder);
      equal(folders, ['101','202','303','404','505','606','707'], `${name}: root folder listing retains shared logos`);
      equal((await db.query("SELECT storage.filename(name) AS file FROM storage.objects WHERE bucket_id='member-logos' AND (storage.foldername(name))[1]='101' ORDER BY file")).rows.map(row => row.file), ['logo.png'], `${name}: own/member folder lists only logo`);
      equal((await db.query("SELECT storage.filename(name) AS file FROM storage.objects WHERE bucket_id='member-logos' AND (storage.foldername(name))[1]='202' ORDER BY file")).rows.map(row => row.file), ['logo.jpg'], `${name}: other-member logo remains shared`);
    }
  });

  equal(baselinePhotos.member, ['101/person.jpg'], 'ordinary member sees only own contact photo');
  equal(baselinePhotos.board, sorted(photoNames), 'board retains shared contact-photo access');
  equal(baselinePhotos.admin, sorted(photoNames), 'admin retains contact-photo access');
  equal(baselinePhotos.revokedAdmin, [], 'restrictive revocation policy denies privileged actor');

  await asActor('admin', async () => {
    const inserted = await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('agenda-images','new-orphan-upload.png') RETURNING name");
    equal(inserted.rows.map(row => row.name), ['new-orphan-upload.png'], 'admin inserts upload before an agenda record exists');
    equal((await db.query("SELECT count(*)::integer AS count FROM storage.objects WHERE bucket_id='agenda-images' AND name='new-orphan-upload.png'")).rows[0].count, 1, 'admin can immediately preview unlinked upload');
  });

  await asActor('member', async () => {
    equal((await db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('member-logos','101/logo.webp') RETURNING name")).rows.map(row => row.name), ['101/logo.webp'], 'own logo insert survives');
    equal((await db.query("UPDATE storage.objects SET metadata='{\"fixture\":true}' WHERE bucket_id='member-logos' AND name='101/logo.webp' RETURNING name")).rows.map(row => row.name), ['101/logo.webp'], 'own logo update survives');
    equal((await db.query("INSERT INTO storage.objects(bucket_id,name,metadata) VALUES ('member-logos','101/logo.png','{\"upsert\":true}') ON CONFLICT(bucket_id,name) DO UPDATE SET metadata=EXCLUDED.metadata RETURNING name")).rows.map(row => row.name), ['101/logo.png'], 'own logo upsert survives');
    equal((await db.query("UPDATE storage.objects SET metadata='{\"forbidden\":true}' WHERE bucket_id='member-logos' AND name='202/logo.jpg' RETURNING name")).rows, [], 'cannot update another member logo');
    await denied("INSERT INTO storage.objects(bucket_id,name) VALUES ('member-logos','202/logo.webp')", [], 'cannot insert another member logo');
    equal((await db.query("DELETE FROM storage.objects WHERE bucket_id='member-logos' AND name='101/logo.webp' RETURNING name")).rows.map(row => row.name), ['101/logo.webp'], 'own logo replacement delete survives');
  });

  await asActor('revokedAdmin', async () => {
    await denied("INSERT INTO storage.objects(bucket_id,name) VALUES ('agenda-images','revoked-upload.png')", [], 'revoked admin cannot upload');
    equal((await db.query("UPDATE storage.objects SET metadata='{\"forbidden\":true}' WHERE bucket_id='agenda-images' RETURNING name")).rows, [], 'revoked admin cannot update');
  });
  await asActor('anon', async () => {
    equal((await db.query("SELECT image_path FROM public.get_agenda_share('SYNTHP')")).rows.map(row => row.image_path), ['published.png'], 'existing explicit public share contract survives');
    await denied("INSERT INTO storage.objects(bucket_id,name) VALUES ('member-logos','101/logo.webp')", [], 'anonymous caller cannot upload');
  });

  console.log(JSON.stringify({ stage: 'after', status: 'PASS', checks, actors: Object.keys(actors).length, unlinkedAgenda: 0, unlinkedLogos: 0, otherStoragePoliciesUnchanged: storagePolicyCount - 2, database: 'PGlite in-memory; synthetic fixtures only' }));
}

main().then(() => db.close()).catch(async error => {
  console.error(JSON.stringify({ status: 'FAIL', checks, message: String(error.message).slice(0,1200), code: error.code || null }));
  await db.close().catch(() => {});
  process.exitCode = 1;
});
