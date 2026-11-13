const { exec } = require('child_process');
exec('node C:/Users/kanem/SHOS-V2/smoke-test.cjs C:/Users/kanem/SHOS-V2/healthcare-sti-test-card.html --min-cards 8', (error, stdout, stderr) => {
  if (error) {
    console.error('Error:', error);
    console.error(stdout);
    console.error(stderr);
  } else {
    console.log('Success:', stdout);
  }
});