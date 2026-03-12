const fs = require('fs');
const path = require('path');

const cwd = path.join(__dirname, '..');
const files = ['chapter1.json','chapter2.json','chapter3.json','chapter4.json','chapter5.json'].map(f=>path.join(cwd,f));

files.forEach(file => {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.warn('Skipping (not array):', file);
      return;
    }
    let changed = false;
    data.forEach(item => {
      if (!item || !Array.isArray(item.options)) return;
      const idx = item.answer;
      if (typeof idx === 'number' && idx >=0 && idx < item.options.length) {
        const newExplain = String(item.options[idx]);
        if (item.explain !== newExplain) {
          item.explain = newExplain;
          changed = true;
        }
      }
    });
    if (changed) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log('Updated explains in', path.basename(file));
    } else {
      console.log('No changes for', path.basename(file));
    }
  } catch (err) {
    console.error('Error processing', file, err.message);
  }
});
