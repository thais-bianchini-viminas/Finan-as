fetch('http://localhost:3000/api/webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: {
      chat: { id: 12345 },
      text: "Uber 22.50"
    }
  })
}).then(r => r.json()).then(console.log).catch(console.error);
