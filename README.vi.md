# Active Directory Sync

🌐 [English](README.md) | **Tiếng Việt**

Một ứng dụng bảng điều khiển (Dashboard) được xây dựng trên nền tảng Next.js giúp đồng bộ hóa và quản lý dữ liệu người dùng từ Active Directory / LDAP với cơ sở dữ liệu PostgreSQL, tích hợp xác thực đa nguồn và phân quyền chi tiết (RBAC).

---

## ✨ Tính năng chính

- **Trình thiết lập ban đầu (Initial Setup Wizard - `/setup`)** — Tự động chuyển hướng và hướng dẫn khởi tạo tài khoản Super Admin cục bộ đầu tiên và cấu hình kết nối LDAP khi ứng dụng khởi chạy lần đầu trên database trống.
- **Cấu hình LDAP động** — Lưu trữ cấu hình LDAP trực tiếp trong Database, chỉnh sửa linh hoạt trên giao diện UI mà không cần khai báo tĩnh trong tệp `.env`.
- **Xác thực đa nguồn (Local & LDAP)**:
  - **Tài khoản AD/LDAP**: Đăng nhập bằng tài khoản doanh nghiệp trực tiếp qua Active Directory.
  - **Tài khoản Cục bộ (Local User)**: Bypass kết nối LDAP, xác thực trực tiếp bằng mật khẩu đã băm `bcryptjs` trong database. Giúp quản trị viên luôn có thể đăng nhập ngay cả khi LDAP gặp sự cố.
- **Lập lịch tự động đồng bộ** — Tự động đồng bộ người dùng chạy ngầm định kỳ theo chu kỳ cấu hình động (1h, 6h, 12h, 24h, v.v.).
- **Bảng điều khiển & Biểu đồ trực quan**:
  - **Donut Chart**: Tỷ lệ trạng thái đồng bộ người dùng.
  - **Horizontal Bar Chart**: Thống kê số lượng nhân sự theo top 5 phòng ban.
  - **Smooth Area Chart**: Timeline thống kê logs hoạt động trong 7 ngày gần nhất.
- **Quản lý vai trò & Phân quyền (RBAC)** — Định nghĩa vai trò tùy chỉnh và kiểm soát quyền truy cập chi tiết (`users:read`, `roles:update`, `ldap:sync`, v.v.).
- **Nhật ký hoạt động (Audit Logs)** — Ghi nhận mọi thao tác của hệ thống, so sánh chi tiết trạng thái trước/sau thay đổi (Before/After) của các đối tượng.
- **Hỗ trợ đa ngôn ngữ tập trung (i18n)** — Hỗ trợ 4 ngôn ngữ: **Tiếng Anh**, **Tiếng Việt**, **Tiếng Thái**, và **Tiếng Nhật** thông qua hệ thống Locale Registry tập trung dễ dàng mở rộng.

---

## 🛠️ Công nghệ sử dụng

| Tầng | Công nghệ |
|---|---|
| Framework | Next.js 15+ (App Router) |
| Ngôn ngữ | TypeScript |
| UI/CSS | Tailwind CSS v4 + Vanilla CSS |
| Database | PostgreSQL 17 |
| ORM | Prisma 7 |
| LDAP Client | ldapts |
| Xác thực | bcryptjs + jose (JWT Session Cookie) |
| Đa ngôn ngữ | Custom Client/Server i18n |

---

## 🚀 Hướng dẫn khởi chạy

### Điều kiện tiên quyết

- Máy tính đã cài đặt [Node.js](https://nodejs.org/) (hoặc [Bun](https://bun.sh/))
- Đã cài đặt [Docker](https://www.docker.com/) (để chạy PostgreSQL)

### 1. Cài đặt các thư viện phụ thuộc

```bash
git clone https://github.com/ntuan2502/next-activedirectory-base.git
cd next-activedirectory-base
pnpm install
```

### 2. Thiết lập biến môi trường

Sao chép tệp cấu hình mẫu:

```bash
cp .env.example .env
```

Cập nhật các biến cơ sở dữ liệu và session secret trong `.env` (Không cần khai báo biến LDAP):

```env
# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_password
POSTGRES_DB=ad_sync
POSTGRES_PORT=5432

# Connection URL for Prisma
DATABASE_URL=postgresql://postgres:postgres_password@localhost:5432/ad_sync?schema=public

# Session Security
SESSION_SECRET=change_me_to_a_random_string_at_least_32_chars
NODE_ENV=development
```

### 3. Khởi chạy PostgreSQL qua Docker

```bash
docker compose up -d
```

### 4. Đẩy cấu trúc Schema vào Database

```bash
pnpm prisma db push
```

### 5. Khởi chạy Development Server

```bash
pnpm dev
```

Mở trình duyệt truy cập [http://localhost:3000](http://localhost:3000). 

> 💡 **Khởi chạy lần đầu**: Do database trống chưa có người dùng nào, hệ thống sẽ tự động chuyển hướng bạn đến `/setup` để bắt đầu đăng ký tài khoản Admin và cấu hình kết nối LDAP.

---

## 📂 Cấu trúc thư mục dự án

```plaintext
├── src/
│   ├── app/
│   │   ├── (dashboard)/                # Nhóm Route sử dụng Sidebar Layout
│   │   │   ├── audit-logs/             # Trang xem logs & so sánh thay đổi
│   │   │   ├── roles/                  # Quản lý phân quyền RBAC
│   │   │   ├── settings/               # Cấu hình LDAP & Chu kỳ đồng bộ
│   │   │   ├── users/                  # Quản lý người dùng đã đồng bộ
│   │   │   └── page.tsx                # Dashboard biểu đồ phân tích trực quan
│   │   ├── login/                      # Trang đăng nhập
│   │   ├── setup/                      # Setup Wizard (2 bước khởi tạo hệ thống)
│   │   ├── api/                        # Hệ thống API endpoints
│   │   │   ├── setup/                  # APIs phục vụ Setup Wizard
│   │   │   ├── auth/                   # APIs đăng nhập, đăng xuất, session
│   │   │   ├── settings/               # API lưu/tải cấu hình hệ thống
│   │   │   └── ...
│   │   └── layout.tsx                  # Root Layout
│   ├── components/                     # Các UI Component dùng chung
│   ├── config/
│   │   ├── locales/                    # Định nghĩa bản dịch: en.ts, vi.ts, th.ts, ja.ts
│   │   │   ├── index.ts                # Locale Registry tập trung
│   │   │   └── ...
│   │   └── permissions.ts              # Danh sách định nghĩa quyền hạn
│   ├── lib/
│   │   ├── auth.ts                     # Logic xác thực Local & LDAP
│   │   ├── ldap.ts                     # Kết nối LDAP client & lấy config từ DB
│   │   ├── scheduler.ts                # Tiến trình đồng bộ tự động chạy ngầm
│   │   └── sync-core.ts                # Hàm đồng bộ lõi đồng nhất
```

---

## 🔒 Luồng xác thực & Đăng nhập (Authentication Flow)

```plaintext
              Người dùng gửi yêu cầu Đăng nhập
                             │
                             ▼
              Tìm kiếm User trong Database local
                             │
                 ┌───────────┴───────────┐
                 ▼                       ▼
            Tìm thấy user           Không tìm thấy
                 │                       │
       ┌──────────┴──────────┐            ▼
       ▼                     ▼     Thực hiện LDAP Bind
   dn === "" (Local)     dn !== ""  (Xác thực trực tiếp AD)
       │               (User AD)          │
       ▼                     │            ▼
So khớp mật khẩu            │     ┌──────┴──────┐
  bằng bcrypt               ▼     ▼             ▼
       │             Thử kết nối LDAP   Thành công  Thất bại
       │             và xác thực Bind      │             │
       │                     │             ▼             ▼
       │             ┌───────┴──────┐  Đồng bộ User    Lỗi
       ▼             ▼              ▼  & Tạo Session
Kết quả matches   Thành công    Thất bại
       │             │              │
       ▼             ▼              ▼
   Tạo Session   Tạo Session       Lỗi
```

---

## ⚡ Đồng bộ thời gian thực qua Server-Sent Events (SSE)

Ứng dụng sử dụng cơ chế **Server-Sent Events (SSE)** để truyền tải các sự kiện thời gian thực một chiều từ server đến client nhằm đồng bộ trạng thái hệ thống:
- **Tùy chọn hiển thị**: Thay đổi cài đặt hiển thị (theme, ngôn ngữ, kích thước chữ...) trên một thiết bị sẽ tự động đồng bộ sang tất cả các thiết bị khác đang hoạt động của cùng một tài khoản.
- **Quyền hạn**: Thay đổi vai trò hoặc phân quyền của người dùng sẽ cập nhật quyền hạn thực tế trên client ngay lập tức mà không cần tải lại trang.
- **Kiểm soát phiên đăng nhập (Kicked Overlay)**: Khi một phiên làm việc hiện tại bị thu hồi từ xa (thực hiện từ thiết bị khác), client sẽ lập tức hiển thị màn hình khóa cảnh báo bị "đá văng" (giống cơ chế game online) và điều hướng về trang đăng nhập.

### 📐 Thiết kế Kiến trúc & Hướng nâng cấp (Scale-up)

Dự án hiện đang áp dụng **Phương án A** cho môi trường chạy đơn lẻ (Single Instance), đồng thời sẵn sàng kiến trúc để nâng cấp lên **Phương án B** khi cần phân tải (Multi-Instance/Cluster).

#### Phương án A: EventEmitter toàn cục trong bộ nhớ (Hiện tại)
- **Cơ chế**: Sử dụng Node.js `EventEmitter` toàn cục (`SseManager`) để trung chuyển các sự kiện giữa các API Routes và các kết nối SSE HTTP Stream hiện hoạt.
- **Ưu điểm**:
  - Không cần thêm hạ tầng bên thứ ba.
  - Phù hợp tuyệt đối cho cấu hình chạy trên 1 server duy nhất.
  - Tích hợp sẵn cơ chế lưu instance toàn cục (`globalRef`) tránh bị reset kết nối khi Hot Reload (HMR) trong môi trường phát triển.
- **Nhược điểm**: Không hỗ trợ chạy song song nhiều server (Horizontal Scaling) do bộ nhớ `EventEmitter` bị cô lập trên từng process.

#### Phương án B: Sử dụng Broker (Redis Pub/Sub hoặc PostgreSQL LISTEN/NOTIFY)
Khi triển khai ứng dụng trên cụm nhiều máy chủ (Cluster / Kubernetes) phía sau Load Balancer, ta cần nâng cấp cơ chế phát sự kiện để chia sẻ trạng thái giữa các máy chủ:

1. **PostgreSQL `LISTEN/NOTIFY` (Khuyên dùng khi không muốn thêm hạ tầng Redis)**:
   - **Cách hoạt động**:
     - Khi một sự kiện xảy ra (ví dụ: cập nhật cài đặt), API Route thực hiện câu lệnh SQL:
       ```sql
       NOTIFY sse_channel, '{"userId": "123", "type": "SETTINGS_UPDATED", "payload": {...}}';
       ```
     - Trong API route SSE `/api/auth/sse`, tạo một kết nối client PostgreSQL riêng biệt chạy lệnh `LISTEN sse_channel` và lắng nghe sự kiện bằng driver pg (`pg.on('notification')`). Khi nhận được notification, server sẽ đẩy tiếp sự kiện đó xuống HTTP connection của client.
   - **Ưu điểm**: Tận dụng cơ sở dữ liệu PostgreSQL sẵn có mà không cần cài đặt thêm phần mềm trung gian.

2. **Redis Pub/Sub (Phù hợp khi hệ thống có tải cực lớn)**:
   - **Cách hoạt động**:
     - Cài đặt thư viện Redis client (như `ioredis`).
     - Khi có sự kiện cần phát đi, API route gọi `redisPublishClient.publish("user:sse:channel", JSON.stringify(event))`.
     - Phía API Route SSE `/api/auth/sse` sẽ tạo một `redisSubscribeClient` riêng, thực hiện lắng nghe kênh `redisSubscribeClient.subscribe("user:sse:channel")` và forward dữ liệu sự kiện xuống writer của stream HTTP client.
   - **Ưu điểm**: Hiệu năng cực cao, độ trễ sub-millisecond, quản lý được hàng triệu kết nối đồng thời dễ dàng.

---

## 📝 Danh sách lệnh chính

| Lệnh | Mô tả |
|---|---|
| `pnpm dev` | Khởi chạy server phát triển local |
| `pnpm build` | Biên dịch sản phẩm Next.js |
| `pnpm start` | Khởi chạy server sản phẩm sau khi build |
| `pnpm lint` | Kiểm tra cú pháp & quy tắc viết mã (ESLint) |
| `pnpm prisma db push` | Đồng bộ cấu trúc Schema trực tiếp vào Database |
| `pnpm prisma studio` | Mở giao diện quản lý Database trực quan của Prisma |

---

## 📄 Bản quyền

Mã nguồn được phát hành dưới giấy phép [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
