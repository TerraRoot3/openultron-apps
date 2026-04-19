const xlsx = require('xlsx');
const path = require('path');

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.aoa_to_sheet([
  ['name', 'email', 'company'],
  ['张三', 'zhangsan@example.com', 'ABC公司'],
  ['李四', 'lisi@example.com', 'XYZ公司'],
  ['王五', 'wangwu@example.com', '123公司']
]);
xlsx.utils.book_append_sheet(wb, ws, '收件人');

const filePath = path.join(__dirname, 'test-recipients.xlsx');
xlsx.writeFile(wb, filePath);
console.log('测试 Excel 文件已创建:', filePath);
