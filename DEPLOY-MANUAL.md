# Manual Deploy MangaFrom Web

## 1. Mục tiêu

Tài liệu này mô tả cách triển khai project con (child project) và project cha (parent project) bằng các script có sẵn trong repo:

- Windows: `deploy-child.bat`
- Linux/macOS: `deploy-child.sh`
- Node.js: `deploy-child.js`

## 2. Cấu trúc thư mục quan trọng

```text
<repo-root>/
├── deploy-child.js
├── deploy-child.bat
├── deploy-child.sh
├── firebase/
│   ├── firebase-child-service-account.json
│   └── firebase-parent-service-account.json
├── downloads/
│   └── eor/
│       └── Chap_001/
├── finished/
│   ├── proj-temp/
│   └── proj-eor/
└── public/
```

## 3. Yêu cầu môi trường

### 3.1 Node.js

Cần Node.js 22 (khuyến nghị dùng `fnm` nếu có):

```bash
fnm use 22
```

### 3.2 Firebase CLI

Cài đặt Firebase CLI nếu chưa có:

```bash
npm install -g firebase-tools
```

### 3.3 Service account

File JSON service account phải nằm trong thư mục `firebase/` và được truyền theo tham số.

Ví dụ:

```text
firebase/firebase-danglephd.iptp.test.json
```

## 4. Deploy project con (child deploy)

### 4.1 Cách gọi

#### Windows (CMD / PowerShell)

```powershell
./deploy-child.bat "proj-eor" "eor" "firebase-danglephd.iptp.test.json"
```

#### Linux/macOS

```bash
chmod +x ./deploy-child.sh
./deploy-child.sh "proj-eor" "eor" "firebase-danglephd.iptp.test.json"
```

#### Gọi trực tiếp bằng Node

```bash
node deploy-child.js "proj-eor" "eor" "firebase-danglephd.iptp.test.json"
```

### 4.2 Ý nghĩa tham số

```text
%1 = ten_project
%2 = folder_chu_cung_cap
%3 = file_service_account_json
```

Ví dụ:

```text
ten_project = proj-eor
folder = eor
service_account = firebase-danglephd.iptp.test.json
```

### 4.3 Luồng xử lý

Script sẽ thực hiện các bước sau:

1. Kiểm tra thiếu tham số
2. Kiểm tra `firebase/<service_account_json>` tồn tại
3. Kiểm tra `downloads/<folder>` tồn tại
4. Kiểm tra template `finished/proj-temp` tồn tại
5. Xóa project đích cũ nếu có
6. Copy template vào `finished/<ten_project>`
7. Copy folder nguồn vào `finished/<ten_project>/public/<folder>`
8. Cập nhật `package.json`
9. Cập nhật `.firebaserc`
10. Chạy `node scripts/generate.js`
11. Chạy `yarn build`
12. Set `GOOGLE_APPLICATION_CREDENTIALS`
13. Chạy `firebase deploy`

## 6. Lỗi thường gặp

### 6.1 Thiếu tham số

```text
ERROR: Missing ten_project parameter.
```

Giải pháp: truyền đầy đủ 3 tham số theo đúng thứ tự.

### 6.2 Không tìm thấy service account

```text
ERROR: Service Account not found
```

Giải pháp: đặt file JSON đúng đường dẫn trong thư mục `firebase/`.

### 6.3 Không tìm thấy folder nguồn

```text
ERROR: Source folder not found
```

Giải pháp: kiểm tra `downloads/<folder>` có tồn tại không.

### 6.4 Không tìm thấy template

```text
ERROR: Project template not found
```

Giải pháp: kiểm tra thư mục `finished/proj-temp` có tồn tại.

### 6.5 `fnm use 22` thất bại

```text
ERROR: Failed to switch to Node.js 22 via fnm.
```

Giải pháp:

```bash
fnm install 22
fnm use 22
```

## 7. Ví dụ đầy đủ

### Windows

```powershell
cd E:\bk\source\Node\mangaFrom_web
fnm use 22
.\deploy-child.bat "proj-eor" "eor" "firebase-danglephd.iptp.test.json"
```

### Linux/macOS

```bash
cd /path/to/mangaFrom_web
fnm use 22
chmod +x ./deploy-child.sh
./deploy-child.sh "proj-eor" "eor" "firebase-danglephd.iptp.test.json"
```

## 8. Ghi chú

- `ten_project` không được chứa khoảng trắng.
- `folder` nên là tên thư mục trong `downloads/`, ví dụ: `eor`, `phoenix`, `h2`.
- `service_account` phải là tên file JSON trong `firebase/`.
- Nếu deploy thất bại, hãy kiểm tra `firebase-debug.log` hoặc lỗi trả về từ `firebase deploy`.

---

Nếu cần, có thể tiếp tục bổ sung thêm:

- file `deploy-child.command` cho macOS Double-click
- script tự động generate tên service account theo project
