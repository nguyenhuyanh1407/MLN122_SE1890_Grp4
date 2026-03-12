const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'mindmap.json');

const phrases = [
  'Hiệp định Genève năm 1954',
  'Miền Bắc',
  'Miền Nam',
  'Đảng Cộng sản Việt Nam giữ vai trò lãnh đạo toàn diện',
  'ảng Cộng sản Việt Nam giữ vai trò lãnh đạo toàn diện',
  'Chiến dịch Hồ Chí Minh (30/4/1975)',
  'đất nước hoàn toàn thống nhất.',
  'xây dựng đất nước và quá độ lên chủ nghĩa xã hội.',
  'Nhiệm vụ chủ yếu',
  'hậu phương lớn của cách mạng cả nước',
  'Phong trào Đồng khởi (1959–1960)',
  'Đại hội III',
  'hai nhiệm vụ chiến lược của cách mạng Việt Nam',
  'giải phóng miền Nam',
  'thống nhất đất nước',
  'cách mạng xã hội chủ nghĩa',
  'Vai trò của miền Bắc',
  'cách mạng dân tộc dân chủ nhân dân',
  'Mục tiêu đấu tranh',
  'Hình thức đấu tranh',
  'Đại hội III (1960)',
  'Những ý nghĩa nổi bật',
  'xây dựng chủ nghĩa xã hội ở miền Bắc',
  'đấu tranh giải phóng miền Nam',
  'hậu phương lớn (miền Bắc)',
  'tiền tuyến lớn (miền Nam)',
  'Sự kiện 30 tháng 4 năm 1975',
  'Cộng hòa Xã hội Chủ nghĩa Việt Nam',
  'Cơ sở hạ tầng',
  'Nền kinh tế',
  'Đời sống nhân dân',
  'Đại hội IV (1976)',
  '➡ Đưa cả nước tiến lên chủ nghĩa xã hội',
  'ưu tiên phát triển công nghiệp nặng',
  'khu vực kinh tế nhà nước',
  'nền tảng của nền kinh tế xã hội chủ nghĩa',
  'cơ chế kế hoạch hóa tập trung',
  'mở rộng khu vực kinh tế quốc doanh',
  'tổ chức sản xuất theo hình thức tập thể',
  'hệ thống tem phiếu',
  'thiếu vốn đầu tư',
  'thiếu công nghệ và trang thiết bị hiện đại',
  'bộ máy quản lý còn quan liêu, bao cấp',
  'sản xuất kém hiệu quả',
  'hàng hóa khan hiếm trên thị trường',
  'lạm phát tăng cao',
  'đổi mới tư duy kinh tế',
  'khó khăn nghiêm trọng',
  'Đại hội V (1982)'
];

function escapeRegex(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function processDescription(s) {
  if (typeof s !== 'string') return s;

  // remove existing bold tags to avoid nesting
  s = s.replace(/<\/?b>/gi, '');

  // normalize newlines
  s = s.replace(/\r\n/g, '\n');

  // ensure single blank line between paragraphs
  s = s.replace(/\n\s*\n+/g, '\n\n');

  // Capitalize first letter of the whole description
  s = s.replace(/^([\s]*)(\p{L})/u, (_, a, b) => a + b.toUpperCase());

  // Capitalize first letter after a paragraph break
  s = s.replace(/\n\n\s*(\p{L})/gu, (m, ch) => '\n\n' + ch.toUpperCase());

  // Capitalize first letter after a dash at start of line
  s = s.replace(/(\n-\s*)(\p{Ll})/gu, (_, pre, ch) => pre + ch.toUpperCase());

  // Bold phrases (longer phrases first to avoid partial matches)
  const sorted = [...phrases].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    if (!p || p.trim() === '') continue;
    const re = new RegExp(escapeRegex(p), 'g');
    s = s.replace(re, (m) => '<b>' + m + '</b>');
  }

  return s;
}

function traverse(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) traverse(item);
    return;
  }
  for (const k of Object.keys(obj)) {
    if (k === 'description' && typeof obj[k] === 'string') {
      obj[k] = processDescription(obj[k]);
    } else {
      traverse(obj[k]);
    }
  }
}

try {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  traverse(data);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Updated descriptions in', filePath);
} catch (err) {
  console.error('Error processing file:', err.message);
  process.exit(1);
}
