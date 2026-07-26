import fs from 'fs';
import path from 'path';

function restoreNocheckInTests(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      restoreNocheckInTests(fullPath);
    } else if (fullPath.endsWith('.test.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!content.startsWith('// @ts-nocheck')) {
        fs.writeFileSync(fullPath, '// @ts-nocheck\n' + content);
        console.log('Restored in', fullPath);
      }
    }
  }
}

restoreNocheckInTests(path.join(process.cwd(), 'server', 'src'));
