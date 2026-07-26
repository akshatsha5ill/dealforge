import fs from 'fs';
import path from 'path';

function removeNocheck(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeNocheck(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.startsWith('// @ts-nocheck')) {
        fs.writeFileSync(fullPath, content.replace('// @ts-nocheck\n', ''));
        console.log('Removed from', fullPath);
      }
    }
  }
}

removeNocheck(path.join(process.cwd(), 'server', 'src'));
