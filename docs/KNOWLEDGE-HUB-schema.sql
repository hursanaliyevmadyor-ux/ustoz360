-- EDUTECHALL Knowledge Hub: ALOHIDA PostgreSQL (pgvector) bazasi uchun sxema LOYIHASI.
-- HOZIRCHA HECH QAYERGA QO'LLANMAGAN. EDUTECHALL (Supabase) bazasiga umuman tegmaydi.
-- Hujjat: docs/KNOWLEDGE-HUB.md (3-bo'lim). Qo'llashdan oldin foydalanuvchi tasdig'i kerak.
-- Parol va kalitlar bu faylda yo'q: ular faqat muhit o'zgaruvchilarida / maxfiy saqlagichda.

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- 1) Tasdiqlangan bilim. Umumiy qidiruvda faqat:
--    scope = 'GLOBAL' AND status = 'APPROVED' AND (expires_at IS NULL OR expires_at > now())
-- ---------------------------------------------------------------------------
create table knowledge_entry (
  id                      uuid primary key default gen_random_uuid(),
  question_canonical      text not null check (length(question_canonical) between 8 and 500),
  answer                  text not null check (length(answer) between 20 and 6000),
  subject                 text,
  topic                   text,
  category                text not null default 'general' check (category in ('general', 'normative')),
  audience                text not null default 'teacher' check (audience in ('teacher', 'general')),
  language                text not null default 'uz',
  -- Egalik va ko'rinish. 1-versiyada faqat GLOBAL ishlatiladi; USER/ORG kelajak uchun zahira.
  scope                   text not null default 'GLOBAL' check (scope in ('GLOBAL', 'ORG', 'USER')),
  owner_ref               text,
  -- [{ "url": "...", "title": "...", "trust": "official|education|media|general", "fetchedAt": "...", "contentHash": "...", "quote": "qisqa iqtibos" }]
  source_references       jsonb not null default '[]',
  source_version          text,
  source_hash             text,
  origin                  text not null check (origin in ('ADMIN', 'CANDIDATE', 'OFFICIAL_IMPORT')),
  status                  text not null default 'APPROVED' check (status in ('APPROVED', 'NEEDS_RECHECK', 'STALE', 'FLAGGED', 'ARCHIVED')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  reviewed_by             text not null,            -- EDUTECHALL admin id (boshqa bazadagi qator: FK yo'q)
  reviewed_at             timestamptz not null,
  expires_at              timestamptz,
  embedding_model_version text not null,
  supersedes_id           uuid references knowledge_entry (id),
  served_count            integer not null default 0,
  last_served_at          timestamptz,
  search_tsv              tsvector generated always as (
                            to_tsvector('simple', coalesce(question_canonical, '') || ' ' || coalesce(answer, ''))
                          ) stored,
  constraint scope_owner check (
    (scope = 'GLOBAL' and owner_ref is null) or (scope <> 'GLOBAL' and owner_ref is not null)
  ),
  -- Me'yoriy ma'lumot: manba va muddat majburiy.
  constraint normative_needs_source check (category <> 'normative' or jsonb_array_length(source_references) > 0),
  constraint normative_needs_expiry check (category <> 'normative' or expires_at is not null)
);
create index knowledge_entry_tsv_idx on knowledge_entry using gin (search_tsv);
create index knowledge_entry_trgm_idx on knowledge_entry using gin (question_canonical gin_trgm_ops);
create index knowledge_entry_lookup_idx on knowledge_entry (status, scope, subject);
create index knowledge_entry_expiry_idx on knowledge_entry (expires_at) where status = 'APPROVED';

-- ---------------------------------------------------------------------------
-- 2) Vektorlar (alohida jadval: embedding modelini almashtirish yozuvga tegmaydi).
--    O'lcham (768) embedding modeli tasdiqlangach aniqlanadi (hujjat 3.1).
-- ---------------------------------------------------------------------------
create table knowledge_embedding (
  knowledge_id    uuid not null references knowledge_entry (id) on delete cascade,
  kind            text not null check (kind in ('question', 'answer')),
  embedding       vector(768) not null,
  model_version   text not null,
  search_metadata jsonb not null default '{}',
  primary key (knowledge_id, kind)
);
create index knowledge_embedding_q_idx on knowledge_embedding using hnsw (embedding vector_cosine_ops) where kind = 'question';

-- ---------------------------------------------------------------------------
-- 3) Baholash. Bir foydalanuvchi bir yozuvga bitta ovoz (voter_ref = HMAC, shaxs emas).
-- ---------------------------------------------------------------------------
create table knowledge_feedback (
  id           bigserial primary key,
  knowledge_id uuid not null references knowledge_entry (id) on delete cascade,
  rating       smallint not null check (rating in (-1, 1)),
  reason       text check (reason in ('wrong', 'outdated', 'unclear', 'off_topic', 'other')),
  note         text check (length(note) <= 300),
  voter_ref    text not null,
  created_at   timestamptz not null default now(),
  unique (knowledge_id, voter_ref)
);
create index knowledge_feedback_entry_idx on knowledge_feedback (knowledge_id, rating);

-- ---------------------------------------------------------------------------
-- 4) Nomzodlar: faqat tozalangan, umumlashtirilgan savol (xom chat matni emas), faqat rozilik bilan.
--    contributor_ref ko'rib chiqilgach NULL qilinadi. Avtomatik tasdiq yo'q.
-- ---------------------------------------------------------------------------
create table knowledge_candidate (
  id                    uuid primary key default gen_random_uuid(),
  normalized_question   text not null check (length(normalized_question) between 8 and 500),
  proposed_answer       text not null,
  subject               text,
  topic                 text,
  category              text not null default 'general' check (category in ('general', 'normative')),
  generated_by_provider text not null,
  model                 text,
  prompt_version        text,
  evidence              jsonb not null default '{}',     -- manbalar, ishlatilgan bilim yozuvlari, ikkinchi tekshiruv natijasi
  auto_checks           jsonb not null default '{}',
  risk_flags            text[] not null default '{}',
  review_status         text not null default 'PENDING_AUTOCHECK'
                        check (review_status in ('PENDING_AUTOCHECK', 'PENDING_REVIEW', 'NEEDS_SOURCE', 'APPROVED', 'REJECTED', 'DUPLICATE', 'EXPIRED')),
  duplicate_of          uuid references knowledge_entry (id),
  ask_count             integer not null default 1,
  consent_basis         text not null check (consent_basis in ('USER_CONSENT', 'ADMIN_AUTHORED')),
  contributor_ref       text,
  question_embedding    vector(768),
  created_at            timestamptz not null default now(),
  expires_at            timestamptz not null default (now() + interval '60 days'),
  reviewed_by           text,
  reviewed_at           timestamptz,
  review_note           text,
  constraint consent_needs_ref_until_review check (
    consent_basis <> 'USER_CONSENT' or review_status in ('APPROVED', 'REJECTED', 'DUPLICATE', 'EXPIRED') or contributor_ref is not null
  )
);
create index knowledge_candidate_status_idx on knowledge_candidate (review_status, created_at);
create index knowledge_candidate_contrib_idx on knowledge_candidate (contributor_ref) where contributor_ref is not null;

-- ---------------------------------------------------------------------------
-- 5) Audit: faqat qo'shiladi. O'zgartirish va o'chirishni trigger taqiqlaydi.
-- ---------------------------------------------------------------------------
create table knowledge_audit (
  id           bigserial primary key,
  operation    text not null,              -- masalan: candidate.approve, entry.archive, entry.flag, provider.policy_update
  actor        text not null,              -- admin id yoki "system"
  at           timestamptz not null default now(),
  entry_id     uuid,
  candidate_id uuid,
  metadata     jsonb not null default '{}'
);
create index knowledge_audit_at_idx on knowledge_audit (at desc);

create function knowledge_audit_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'knowledge_audit faqat qo''shiladi: o''zgartirib yoki o''chirib bo''lmaydi';
end $$;
create trigger knowledge_audit_no_change before update or delete on knowledge_audit
  for each row execute function knowledge_audit_immutable();

-- ---------------------------------------------------------------------------
-- 6) Provayder siyosati va sog'liq ko'rsatkichlari (KALIT YO'Q: kalitlar faqat muhit o'zgaruvchilarida).
--    provider_id: "free1".."free10" (FREE_LLM, FREE_LLM2_.. slotlari) yoki "claude".
-- ---------------------------------------------------------------------------
create table provider_policy (
  provider_id    text primary key,
  label          text not null,
  role           text not null default 'disabled' check (role in ('primary', 'fallback', 'verifier', 'disabled')),
  capabilities   jsonb not null default '{}',            -- { "uzQuality": 1-5, "json": true, "longContext": false }
  rpm            integer check (rpm > 0),
  rpd            integer check (rpd > 0),
  price_in_mtok  numeric(10, 4) not null default 0,       -- USD / 1 mln token
  price_out_mtok numeric(10, 4) not null default 0,
  data_policy    text not null default 'unknown' check (data_policy in ('no_train', 'may_train', 'unknown')),
  updated_by     text,
  updated_at     timestamptz not null default now()
);

create table provider_health (
  provider_id text not null,
  bucket      timestamptz not null,                       -- daqiqa boshi
  calls       integer not null default 0,
  errors      integer not null default 0,
  rate_limited integer not null default 0,
  p50_ms      integer,
  tokens_in   bigint not null default 0,
  tokens_out  bigint not null default 0,
  cost_micro  bigint not null default 0,
  primary key (provider_id, bucket)
);

-- ---------------------------------------------------------------------------
-- 7) Matnsiz so'rov jurnali (90 kun) va kunlik yig'ma ehtiyoj. Foydalanuvchi identifikatori YO'Q.
-- ---------------------------------------------------------------------------
create table hub_request (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  outcome     text not null check (outcome in ('KB_HIT', 'KB_GROUNDED', 'AI', 'REFUSED', 'ERROR')),
  provider_id text,
  entry_id    uuid,
  subject     text,
  topic       text,
  latency_ms  integer,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  cost_micro  integer
);
create index hub_request_at_idx on hub_request (at desc);

create table demand_daily (
  day               date not null,
  subject           text not null default '',
  topic             text not null default '',
  asked             integer not null default 0,
  answered_from_kb  integer not null default 0,
  answered_by_ai    integer not null default 0,
  unanswered        integer not null default 0,
  helpful           integer not null default 0,
  unhelpful         integer not null default 0,
  corrections       integer not null default 0,
  primary key (day, subject, topic)
);

-- ---------------------------------------------------------------------------
-- 8) Kirish nazorati. Ommaviy (anon/authenticated) rol hech narsa o'qiy olmaydi.
--    knowledge_svc paroli bu faylda YO'Q: baza yaratilganda maxfiy saqlagichdan beriladi:
--    create role knowledge_svc login password '<maxfiy saqlagichdan>';
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['knowledge_entry', 'knowledge_embedding', 'knowledge_feedback', 'knowledge_candidate',
                           'knowledge_audit', 'provider_policy', 'provider_health', 'hub_request', 'demand_daily']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    -- FORCE: jadval egasi ham siyosatsiz o'qiy/yoza olmaydi, shuning uchun quyidagi siyosat roldan keyin qo'shilgach ishlatiladi.
    -- Siyosat knowledge_svc roli yaratilgandan keyin qo'shiladi:
    -- execute format('create policy svc_all on %I for all to knowledge_svc using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- NAMUNA: gibrid qidiruv (vektor + kalit so'z, RRF). Ilova tomonida parametrlar:
--   $1 = savol vektori (768), $2 = kalit so'z so'rovi, masalan: 'fotos:* | sinte:*' (so'zning dastlabki 5 harfi: rag.ts dagi stem bilan bir xil)
--   $3 = fan (ixtiyoriy, null bo'lishi mumkin)
-- ---------------------------------------------------------------------------
-- with ok as (
--   select e.* from knowledge_entry e
--   where e.scope = 'GLOBAL' and e.status = 'APPROVED' and (e.expires_at is null or e.expires_at > now())
--     and ($3::text is null or e.subject = $3 or e.subject is null)
-- ),
-- vec as (
--   select m.knowledge_id as id, 1 - (m.embedding <=> $1) as sim,
--          row_number() over (order by m.embedding <=> $1) as r
--   from knowledge_embedding m join ok on ok.id = m.knowledge_id
--   where m.kind = 'question' order by m.embedding <=> $1 limit 20
-- ),
-- kw as (
--   select ok.id, row_number() over (order by ts_rank_cd(ok.search_tsv, to_tsquery('simple', $2)) desc) as r
--   from ok where ok.search_tsv @@ to_tsquery('simple', $2) limit 20
-- )
-- select ok.id, ok.question_canonical, ok.answer, ok.source_references, ok.reviewed_at, ok.expires_at, v.sim,
--        coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + k.r), 0) as rrf
-- from ok left join vec v on v.id = ok.id left join kw k on k.id = ok.id
-- where v.id is not null or k.id is not null
-- order by rrf desc limit 5;
