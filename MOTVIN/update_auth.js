const fs = require('fs');

const filePaths = ['styles.html', 'typeface.html'];

for (const p of filePaths) {
  let content = fs.readFileSync(p, 'utf8');
  
  // Find </script> followed by <script src="../JS/theme-manager.js"></script>
  // and insert the auth scripts between them.
  const regex = /<\/script>\s*<script src="\.\.\/JS\/theme-manager\.js"><\/script>/g;
  
  if (regex.test(content)) {
    content = content.replace(
      regex,
      `</script>\n    <script src="../JS/firebase-config.js" defer></script>\n    <script src="../JS/firebase-auth.js" defer></script>\n    <script src="../JS/theme-manager.js"></script>`
    );
    fs.writeFileSync(p, content, 'utf8');
    console.log(`Updated ${p}`);
  } else {
    console.log(`Could not find the target string in ${p}`);
  }
}
