-- Module Pháp lý dự án (app-09 · MOD-09) — dùng chung CSDL ctg_qlda với Module Quản lý dự án
-- (app_user, session, project, member, milestone, setting, activity). Bảng riêng có tiền tố pl_.
-- Chạy lại an toàn. Phiên bản 2 (17/10/2026): bỏ toàn bộ chức năng cũ, thay bằng
--   1) checklist hồ sơ theo bước + đối chiếu tệp + AI kiểm tra   2) soạn dự thảo văn bản
--   3) chức năng riêng từng bước (bồi thường từng hộ, AI đối chiếu kết quả scan)   4) kế hoạch pháp lý.

-- bảng của phiên bản cũ (chỉ chứa dữ liệu đồng bộ, không có dữ liệu người dùng nhập)
DROP TABLE IF EXISTS pl_req, pl_sale_cond, pl_filing_event, pl_filing_doc, pl_filing, pl_deadline, pl_reg_change, pl_chat, pl_draft CASCADE;

-- ===== danh mục tham chiếu (đồng bộ chỉ đọc từ QLDA duan_noxh_ct) =====
CREATE TABLE IF NOT EXISTS pl_phase (code text PRIMARY KEY, name text NOT NULL, ord int);
CREATE TABLE IF NOT EXISTS pl_agency (id uuid PRIMARY KEY, code text, name text NOT NULL, short_name text);
CREATE TABLE IF NOT EXISTS pl_procedure (
  id uuid PRIMARY KEY, code text, name text NOT NULL, phase_code text, agency_text text, basis_text text, result_text text,
  deadline_text text, deadline_days int, workdays boolean, ord int
);
CREATE TABLE IF NOT EXISTS pl_legal_doc (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), src_id uuid UNIQUE, code text, number_text text, title text NOT NULL, doc_type text, issuer text,
  issued_on date, effective_from date, effective_to date, src_status text, scope text NOT NULL DEFAULT 'Toàn quốc', url text,
  confirmed text, confirmed_by uuid REFERENCES app_user(id), confirmed_at timestamptz, note text, created_by uuid REFERENCES app_user(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pl_legal_rel (src_id uuid PRIMARY KEY, target_id uuid NOT NULL, acting_id uuid NOT NULL, rel_type text, scope_text text, valid_from date);
CREATE TABLE IF NOT EXISTS pl_procedure_basis (procedure_id uuid NOT NULL, legal_src_id uuid NOT NULL, article_text text, PRIMARY KEY (procedure_id, legal_src_id));
-- mốc chuẩn và quan hệ tiền đề → dùng để lập phụ thuộc giữa các bước
CREATE TABLE IF NOT EXISTS pl_mmoc (code text PRIMARY KEY, name text NOT NULL, phase_code text, ord int);
CREATE TABLE IF NOT EXISTS pl_mmoc_proc (moc_code text NOT NULL, procedure_code text NOT NULL, PRIMARY KEY (moc_code, procedure_code));
CREATE TABLE IF NOT EXISTS pl_mmoc_pre (moc_code text NOT NULL, pre_code text NOT NULL, PRIMARY KEY (moc_code, pre_code));
-- biểu mẫu văn bản theo quy định (md.form) gắn với thủ tục
CREATE TABLE IF NOT EXISTS pl_form (code text PRIMARY KEY, name text NOT NULL, legal_number text, usable boolean NOT NULL DEFAULT true, procedure_codes text[] NOT NULL DEFAULT '{}', note text);

-- danh mục hồ sơ bắt buộc của từng dự án bên QLDA (kèm số văn bản chứng minh) → điền sẵn «đã có văn bản» cho mục kết quả
CREATE TABLE IF NOT EXISTS pl_qlda_line (
  src_id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE, line_code text, procedure_code text,
  description text, evidence text, applicable boolean NOT NULL DEFAULT true
);

-- ===== 1) Checklist mẫu theo thủ tục (thư viện dùng chung các dự án) =====
CREATE TABLE IF NOT EXISTS pl_tpl (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_code text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('dau_vao','soan','ket_qua')),   -- hồ sơ đầu vào / văn bản CĐT soạn / kết quả cơ quan trả
  name         text NOT NULL,
  required     boolean NOT NULL DEFAULT true,
  basis        text,                 -- căn cứ (điều, khoản, văn bản)
  source       text NOT NULL DEFAULT 'quy_dinh' CHECK (source IN ('quy_dinh','qlda','du_an_khac','nguoi_dung','ai')),
  form_code    text,                 -- mẫu văn bản (nếu là văn bản soạn)
  doc_kind     text,                 -- loại văn bản để soạn: cong_van, to_trinh, don, quyet_dinh, thong_bao, bao_cao, ke_hoach, bien_ban
  tag          text,                 -- chức năng riêng: qd_pa_ho, phieu_chi_ho, qd_thu_hoi_ho
  ord          int NOT NULL DEFAULT 0,
  seed_key     text UNIQUE,          -- khóa mục khởi tạo sẵn (để chạy lại không nhân bản)
  created_by   uuid REFERENCES app_user(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pl_tpl_proc ON pl_tpl(procedure_code, kind, ord);

-- ===== 4) Các bước pháp lý của dự án = kế hoạch pháp lý =====
CREATE TABLE IF NOT EXISTS pl_step (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  procedure_id uuid REFERENCES pl_procedure(id),
  code         text,                 -- mã thủ tục (TT-GPXD) hoặc mã tự đặt
  name         text NOT NULL,
  phase_code   text,
  agency_text  text,
  ord          int NOT NULL DEFAULT 0,
  deps         uuid[] NOT NULL DEFAULT '{}',   -- các bước phải xong trước
  prep_days    int NOT NULL DEFAULT 15,        -- ngày chuẩn bị hồ sơ (lịch)
  proc_days    int NOT NULL DEFAULT 0,         -- thời hạn cơ quan giải quyết
  workdays     boolean NOT NULL DEFAULT false, -- proc_days tính ngày làm việc
  plan_start   date, plan_submit date, plan_end date,     -- kế hoạch hiện hành
  base_start   date, base_end date,                       -- kế hoạch gốc (đã chốt)
  act_start    date, act_submit date, act_end date,       -- thực tế
  status       text NOT NULL DEFAULT 'chua' CHECK (status IN ('chua','dang','cho_kq','xong','bo_qua')),
  owner_id     uuid REFERENCES app_user(id),
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, procedure_id)
);
CREATE INDEX IF NOT EXISTS ix_pl_step_project ON pl_step(project_id, ord);

-- checklist hồ sơ của từng bước
CREATE TABLE IF NOT EXISTS pl_item (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id    uuid NOT NULL REFERENCES pl_step(id) ON DELETE CASCADE,
  tpl_id     uuid REFERENCES pl_tpl(id) ON DELETE SET NULL,
  kind       text NOT NULL CHECK (kind IN ('dau_vao','soan','ket_qua')),
  name       text NOT NULL,
  required   boolean NOT NULL DEFAULT true,
  basis      text,
  source     text NOT NULL DEFAULT 'quy_dinh',
  form_code  text, doc_kind text, tag text,
  na         boolean NOT NULL DEFAULT false,    -- không áp dụng cho dự án này
  ref_text   text,                              -- số văn bản đã có (chưa có tệp), vd theo QLDA
  note       text,
  ord        int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pl_item_step ON pl_item(step_id, kind, ord);

-- tệp người dùng tải lên (hoặc văn bản đã chốt, kết quả xuất hàng loạt)
CREATE TABLE IF NOT EXISTS pl_file (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES pl_item(id) ON DELETE CASCADE,
  step_id     uuid NOT NULL REFERENCES pl_step(id) ON DELETE CASCADE,
  name        text NOT NULL, mime text, size int, stored text NOT NULL,
  origin      text NOT NULL DEFAULT 'tai_len' CHECK (origin IN ('tai_len','du_thao','xuat_ho')),
  doc_id      uuid,                 -- văn bản dự thảo đã chốt sinh ra tệp này
  current     boolean NOT NULL DEFAULT true,   -- false = phiên bản cũ (đã thay)
  ai_status   text NOT NULL DEFAULT 'cho' CHECK (ai_status IN ('cho','dang','xong','loi','tat','bo_qua')),
  ai_facts    jsonb,                -- AI trích: loại, số hiệu, ngày, cơ quan, các thông số chính
  ai_error    text,
  uploaded_by uuid REFERENCES app_user(id),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pl_file_item ON pl_file(item_id, current);
CREATE INDEX IF NOT EXISTS ix_pl_file_step ON pl_file(step_id, current);

-- kết quả AI kiểm tra (đồng bộ hồ sơ trong bước, đối chiếu kết quả scan, kiểm tra dự thảo)
CREATE TABLE IF NOT EXISTS pl_check (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id    uuid NOT NULL REFERENCES pl_step(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('ho_so','ket_qua','du_thao')),
  target_id  uuid,                  -- tệp kết quả / văn bản dự thảo được kiểm
  status     text NOT NULL DEFAULT 'dang' CHECK (status IN ('dang','xong','loi','da_xu_ly')),
  result     jsonb,                 -- {tom_tat, ket_luan, canh_bao:[{muc_do,loai,noi_dung,ho_so,de_xuat}], da_doi_chieu}
  error      text,
  files      jsonb NOT NULL DEFAULT '[]',   -- tệp đã đưa cho AI
  created_by uuid REFERENCES app_user(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at    timestamptz,
  handled_by uuid REFERENCES app_user(id), handled_at timestamptz, handled_note text
);
CREATE INDEX IF NOT EXISTS ix_pl_check_step ON pl_check(step_id, created_at DESC);

-- ===== 2) Dự thảo văn bản =====
CREATE TABLE IF NOT EXISTS pl_doc (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id      uuid NOT NULL REFERENCES pl_step(id) ON DELETE CASCADE,
  item_id      uuid REFERENCES pl_item(id) ON DELETE SET NULL,
  kind         text NOT NULL CHECK (kind IN ('cong_van','to_trinh','don','quyet_dinh','thong_bao','bao_cao','ke_hoach','bien_ban','giay_uy_quyen')),
  form_code    text,
  request      text,                 -- yêu cầu / ghi chú người soạn đưa cho AI
  issuer       text, unit text, number_text text, place text, date_text text,
  subject      text NOT NULL,
  authority    text,                 -- thẩm quyền ban hành (quyết định)
  bases        jsonb NOT NULL DEFAULT '[]',   -- căn cứ
  recipients   jsonb NOT NULL DEFAULT '[]',   -- kính gửi
  body         text NOT NULL DEFAULT '',
  receivers    jsonb NOT NULL DEFAULT '[]',   -- nơi nhận
  signers      jsonb NOT NULL DEFAULT '[]',   -- [{title,name}]
  cites        jsonb NOT NULL DEFAULT '[]',
  to_check     jsonb NOT NULL DEFAULT '[]',
  by_ai        boolean NOT NULL DEFAULT false,
  status       text NOT NULL DEFAULT 'nhap' CHECK (status IN ('nhap','chot')),
  version      int NOT NULL DEFAULT 1,
  chot_by      uuid REFERENCES app_user(id), chot_at timestamptz,
  created_by   uuid REFERENCES app_user(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pl_doc ADD COLUMN IF NOT EXISTS auto boolean NOT NULL DEFAULT false;   -- hệ thống tự soạn, còn tự cập nhật tới khi có người sửa
CREATE INDEX IF NOT EXISTS ix_pl_doc_step ON pl_doc(step_id, created_at DESC);

-- ===== 3) Bồi thường, hỗ trợ: bảng tổng hợp phương án được duyệt → từng hộ =====
CREATE TABLE IF NOT EXISTS pl_household (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  batch       text NOT NULL DEFAULT 'Đợt 1',
  stt         int,
  ma_ho       text,
  ho_ten      text NOT NULL,
  cccd        text,
  dia_chi     text,
  thua        text, to_bd text, loai_dat text,
  dt_thu_hoi  numeric,               -- m²
  tien_dat    numeric, tien_ts numeric, tien_ht numeric, tien_khac numeric,
  tong        numeric,
  extra       jsonb NOT NULL DEFAULT '{}',
  src_file    text,
  created_by  uuid REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pl_household ON pl_household(project_id, batch, stt);

-- v2.1: vướng mắc của bước (hiện trên dashboard tổng quan)
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS issue_kind text;
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS issue_text text;
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS issue_since date;

-- v2.2: kế hoạch + danh mục hồ sơ nhập từ Excel của dự án; checklist dạng ô đánh dấu, có hạn nộp
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS src_key text;        -- khóa dòng Excel (trang tính : mục : tên việc) để nhập lại không mất dấu tick
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS sheet text;          -- vd «GPMB · I. Bồi thường, hỗ trợ, tái định cư, thu hồi đất»
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS section text;        -- vd «I.1 Lựa chọn tổ chức thực hiện nhiệm vụ BTHT»
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS stt text;
ALTER TABLE pl_step ADD COLUMN IF NOT EXISTS fixed boolean NOT NULL DEFAULT false;   -- ngày do người dùng định (Excel) — lập lịch không dời
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS done boolean NOT NULL DEFAULT false;     -- người dùng tick «đã có»
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS done_at timestamptz;
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS done_by uuid REFERENCES app_user(id);
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS due_on date;          -- hạn có hồ sơ (mặc định = ngày hoàn thành dự kiến của việc)
CREATE UNIQUE INDEX IF NOT EXISTS ux_pl_step_src ON pl_step(project_id, src_key) WHERE src_key IS NOT NULL;

-- v2.3: hồ sơ bổ sung (cơ quan / chuyên viên yêu cầu bổ sung): nội dung, lý do, làm từ ngày → hạn bổ sung
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS supp boolean NOT NULL DEFAULT false;
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS reason text;      -- lý do bổ sung
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS req_by text;      -- cơ quan / người yêu cầu
ALTER TABLE pl_item ADD COLUMN IF NOT EXISTS start_on date;    -- bắt đầu làm từ ngày

-- v2.4: Trợ lý AI — hội thoại của từng người dùng (tệp đính kèm lưu trong data/files, tham chiếu trong files)
CREATE TABLE IF NOT EXISTS pl_ai_chat (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  project_id uuid REFERENCES project(id) ON DELETE SET NULL,
  title      text NOT NULL DEFAULT 'Cuộc trò chuyện mới',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pl_ai_chat_user ON pl_ai_chat(user_id, updated_at DESC);
CREATE TABLE IF NOT EXISTS pl_ai_msg (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id    uuid NOT NULL REFERENCES pl_ai_chat(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','assistant')),
  content    text NOT NULL DEFAULT '',
  files      jsonb NOT NULL DEFAULT '[]',   -- [{name, mime, size, stored, src}]  src = 'tai_len' | 'ho_so'
  mode       text,
  error      text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_pl_ai_msg_chat ON pl_ai_msg(chat_id, created_at);

-- v2.5: giải trình quá hạn + đề xuất hạn mới (chuyên viên) → duyệt (người duyệt / lãnh đạo) → tự cập nhật hạn hồ sơ, công việc và kế hoạch
CREATE TABLE IF NOT EXISTS pl_extend (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  step_id      uuid NOT NULL REFERENCES pl_step(id) ON DELETE CASCADE,
  item_id      uuid REFERENCES pl_item(id) ON DELETE CASCADE,   -- NULL = gia hạn cả công việc
  old_due      date,
  new_due      date NOT NULL,
  reason       text NOT NULL,
  status       text NOT NULL DEFAULT 'cho' CHECK (status IN ('cho','duyet','tu_choi','rut')),
  requested_by uuid REFERENCES app_user(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  decided_by   uuid REFERENCES app_user(id),
  decided_at   timestamptz,
  decision_note text
);
CREATE INDEX IF NOT EXISTS ix_pl_extend_proj ON pl_extend(project_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pl_extend_pending ON pl_extend(step_id, coalesce(item_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE status = 'cho';

-- v2.6: bản chép tệp hồ sơ ra thư mục trên máy tính (HOSO_DIR)
ALTER TABLE pl_file ADD COLUMN IF NOT EXISTS disk_path text;

-- v2.7: Trợ lý AI ghi mô hình đã trả lời (người dùng chọn Sonnet / Fable / Haiku)
ALTER TABLE pl_ai_msg ADD COLUMN IF NOT EXISTS model text;

-- Lịch sự kiện: họp, việc, nhắc việc (như app lịch điện thoại). Giờ lưu dạng HH:MM giờ địa phương; lặp lại mở rộng ở trình duyệt.
CREATE TABLE IF NOT EXISTS pl_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title       text NOT NULL,
  kind        text NOT NULL DEFAULT 'hop' CHECK (kind IN ('hop','viec','nhac','khac')),
  all_day     boolean NOT NULL DEFAULT false,
  start_date  date NOT NULL,
  start_time  text,
  end_date    date NOT NULL,
  end_time    text,
  repeat      text NOT NULL DEFAULT '' CHECK (repeat IN ('','ngay','ngay_lv','tuan','thang','nam')),
  rep_until   date,
  remind      int[] NOT NULL DEFAULT '{}',   -- phút nhắc trước giờ bắt đầu (sự kiện cả ngày: tính từ 09:00 hôm đó)
  location    text,
  attendees   text,
  note        text,
  shared      boolean NOT NULL DEFAULT true, -- false = chỉ người tạo thấy
  created_by  uuid REFERENCES app_user(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz
);
CREATE INDEX IF NOT EXISTS pl_event_proj ON pl_event (project_id, start_date);
-- người tham dự sự kiện là người dùng trong hệ thống: sự kiện hiện trên lịch + thẻ mời trên màn hình của họ
ALTER TABLE pl_event ADD COLUMN IF NOT EXISTS attendee_ids uuid[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS pl_event_invite (
  event_id   uuid NOT NULL REFERENCES pl_event(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at    timestamptz,             -- NULL = chưa xem thẻ mời
  changed    boolean NOT NULL DEFAULT false,   -- sự kiện đổi giờ / địa điểm sau khi mời
  PRIMARY KEY (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS pl_event_invite_user ON pl_event_invite (user_id) WHERE seen_at IS NULL;
