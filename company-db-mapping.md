# Kế hoạch triển khai: Tích hợp bảng Company & Tự động ánh xạ từ AD

Kế hoạch này mô tả các bước thiết lập bảng `Company` trong cơ sở dữ liệu (với đầy đủ các thuộc tính chi tiết của công ty) và cấu hình LDAP Sync để tự động phân tích Distinguished Name (DN) của người dùng từ Active Directory nhằm gán vào Công ty tương ứng.

## 1. Tổng quan & Mục tiêu (Overview & Goals)
- **Loại dự án**: WEB (Next.js App Router)
- **Mục tiêu**:
  - Tạo bảng `Company` mới trong cơ sở dữ liệu qua Prisma với các trường: Mã công ty, Tên tiếng Việt, Tên tiếng Anh, Địa chỉ thuế, Mã số thuế.
  - Chuyển đổi trường `company` của bảng `User` từ dạng chuỗi (`String`) thành quan hệ khóa ngoại (`Relation`) liên kết với bảng `Company`.
  - Cấu hình tệp seed cơ sở dữ liệu để khởi tạo thông tin cho 5 công ty thành viên: `ACBH`, `ACLT`, `ACHL`, `ATLT`, `ACPT`.
  - Cập nhật logic đồng bộ hóa LDAP để tự động phân tích và gán người dùng vào Công ty tương ứng dựa trên phân cấp OU (ví dụ: `OU=ACLT`, `OU=ACBH`).
  - Đảm bảo hiển thị tên công ty thân thiện theo đa ngôn ngữ (ngôn ngữ `vi` dùng `nameVi`, các ngôn ngữ khác dùng `nameEn`) trên Dashboard và bảng quản lý người dùng.
  - Giữ nguyên tính tương thích ngược của API (trả về chuỗi tên công ty phù hợp với locale để giảm thiểu việc sửa đổi lớn ở giao diện).

## 2. Tiêu chí thành công (Success Criteria)
- Tạo bảng `Company` thành công và cập nhật mối quan hệ trong Prisma.
- Seed thành công thông tin chi tiết của 5 công ty vào database.
- Đồng bộ hóa LDAP tự động phân tích chính xác OU của User (ví dụ: `OU=ACLT`) và gán liên kết `companyId` tương ứng.
- Trên giao diện Dashboard và danh sách người dùng hiển thị đúng tên công ty tương ứng theo ngôn ngữ lựa chọn.
- Toàn bộ ứng dụng build thành công và vượt qua kiểm tra chất lượng của Linter/Typecheck.

## 3. Kiến trúc dữ liệu đề xuất (Proposed Database Schema)

### Model `Company` mới:
```prisma
model Company {
  id          String   @id @default(cuid())
  code        String   @unique // Ví dụ: ACLT, ACBH, ACHL, ATLT, ACPT
  nameVi      String   // Tên tiếng Việt: CÔNG TY CỔ PHẦN ĐÔ THỊ AMATA LONG THÀNH
  nameEn      String   // Tên tiếng Anh: AMATA CITY LONGTHANH JOINT STOCK COMPANY
  taxAddress  String   // Địa chỉ thuế
  taxCode     String   // Mã số thuế
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  users       User[]

  @@map("companies")
}
```

### Cập nhật Model `User`:
```prisma
model User {
  // ...
  companyId String?   @map("company_id")
  company   Company?  @relation(fields: [companyId], references: [id], onDelete: SetNull)
  // ...
}
```

## 4. Danh sách công việc cần làm (Task Breakdown)

### Pha 1: Cấu trúc dữ liệu & Di chuyển (Database & Migration)
- **Nhiệm vụ 1.1**: Cập nhật tệp [schema.prisma](file:///prisma/schema.prisma) để khai báo model `Company` và cập nhật quan hệ trên model `User`. (Người thực hiện: `database-architect`)
- **Nhiệm vụ 1.2**: Chạy lệnh tạo migration: `pnpm exec prisma migrate dev --name add_company_model` để cập nhật cơ sở dữ liệu. (Người thực hiện: `database-architect`)
- **Nhiệm vụ 1.3**: Tạo tệp seed dữ liệu hoặc cập nhật `prisma/seed.ts` để khởi tạo thông tin chi tiết cho 5 công ty:
  - `ACLT`:
    - Code: `ACLT`
    - nameVi: `CÔNG TY CỔ PHẦN ĐÔ THỊ AMATA LONG THÀNH`
    - nameEn: `AMATA CITY LONGTHANH JOINT STOCK COMPANY`
    - taxAddress: `Khu Công Nghiệp Công Nghệ Cao Long Thành, Phường Long Thành, Thành phố Đồng Nai, Việt Nam`
    - taxCode: `3603295006`
  - Các công ty `ACBH`, `ACHL`, `ATLT`, `ACPT` sẽ được khởi tạo trước bằng dữ liệu mẫu tương ứng (sẽ được cập nhật chính xác sau). (Người thực hiện: `database-architect`)
- **Nhiệm vụ 1.4**: Viết script di chuyển dữ liệu tạm thời (Seeding/Data Migration) để liên kết các `User` cũ hiện có sang bản ghi `Company` tương ứng dựa trên giá trị cột `company` dạng chuỗi cũ. (Người thực hiện: `database-architect`)

### Pha 2: Cập nhật API Logic đồng bộ (LDAP Sync Backend)
- **Nhiệm vụ 2.1**: Cập nhật logic đồng bộ trong API `/api/ldap/sync`: (Người thực hiện: `backend-specialist`)
  - Phân tích trường `dn` để lấy mã công ty (OU ngay dưới `OU=Users`). Thuật toán: tách `dn` thành mảng bởi dấu phẩy `,`, tìm chỉ mục của phần tử `OU=Users` (không phân biệt hoa thường) và lấy phần tử ngay trước nó (phía bên trái trong DN, ví dụ: trong `OU=ACBH,OU=Users`, ta lấy phần tử `OU=ACBH` và trích xuất ra mã `ACBH`). Điều này đảm bảo xử lý được cả các cấu trúc DN sâu hơn (như `OU=Sync365,OU=IT,OU=ACBH,OU=Users...`).
  - Truy vấn `Company` trong DB theo `code` tương ứng (ví dụ: `code = ACLT`).
  - Gán `companyId` của `User` vào bản ghi `Company` tìm được. Nếu không tìm thấy công ty nào phù hợp $\rightarrow$ Để trống hoặc ghi nhận log cảnh báo cấu hình AD.
- **Nhiệm vụ 2.2**: Cập nhật các API trả về dữ liệu (`GET /api/users`, `GET /api/dashboard/stats`): (Người thực hiện: `backend-specialist`)
  - Trả về trường `company` dạng chuỗi (Sử dụng `company.nameVi` nếu locale yêu cầu là `vi`, ngược lại sử dụng `company.nameEn`) để đảm bảo tính tương thích ngược hoàn toàn với giao diện và biểu đồ hiện tại.

### Pha 3: Giao diện & Kiểm thử (UI, Verification & Polish)
- **Nhiệm vụ 3.1**: Cập nhật giao diện trang quản lý người dùng và Dashboard để hiển thị tên công ty chi tiết theo ngôn ngữ. (Người thực hiện: `frontend-specialist`)
- **Nhiệm vụ 3.2**: Chạy kiểm thử tích hợp để xác thực kết quả đồng bộ LDAP thực tế từ Active Directory. (Người thực hiện: `test-engineer`)
- **Nhiệm vụ 3.3**: Chạy `pnpm lint` và `pnpm exec tsc --noEmit` để đảm bảo hệ thống không có bất kỳ lỗi lầm nào. (Người thực hiện: `frontend-specialist`)

## 5. Kế hoạch xác minh (Verification Plan)

### Kiểm tra tự động (Automated Tests)
- `pnpm lint` (đảm bảo không lỗi cú pháp, chỉ chạy khi có thay đổi)
- `pnpm exec tsc --noEmit` (đảm bảo không lỗi kiểu dữ liệu)
- `pnpm run build` (đảm bảo build thành công sản phẩm)

### Kiểm tra thủ công (Manual Verification)
- Nhấp vào nút "Đồng bộ ngay" trên trang quản trị LDAP.
- Xác nhận trong cơ sở dữ liệu xem bảng `companies` đã được tạo mới và liên kết đúng với bảng `users`.
- Kiểm tra biểu đồ và danh sách trên trang Dashboard xem tên các công ty hiển thị đúng chuẩn tên đầy đủ theo đa ngôn ngữ.

---

## 6. Biện pháp khôi phục nếu xảy ra lỗi (Rollback Strategy)
- Nếu việc áp dụng Prisma Migration gặp lỗi, thực hiện khôi phục schema bằng lệnh `git checkout prisma/schema.prisma` và khôi phục database bằng cách áp dụng bản sao lưu hoặc reset database cục bộ.
- Nếu dữ liệu bị lỗi liên kết trong quá trình nâng cấp, sử dụng script khôi phục chuyển đổi ngược từ `companyId` về lại cột chuỗi `company` của `User`.

---

## ✅ PHASE X: VERIFICATION CHECKLIST
- [ ] Lint: ⬜ Chờ kiểm tra
- [ ] Security: ⬜ Chờ kiểm tra
- [ ] Build: ⬜ Chờ kiểm tra
- [ ] Date: [Chưa hoàn thành]
