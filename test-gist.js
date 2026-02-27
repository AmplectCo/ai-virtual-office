#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = fs.readFileSync(path.join(__dirname, '../.github_gist_token'), 'utf8').trim();
const GIST_ID_FILE = path.join(__dirname, '.gist_id');

async function createTestGist() {
  const data = {
    timestamp: new Date().toISOString(),
    activeCharacters: ['dmitriy'],
    sessions: [
      {
        telegramId: '506059567',
        character: 'dmitriy',
        lastActive: Date.now()
      }
    ]
  };

  const payload = {
    description: 'Amplect Office - Active Sessions',
    public: true,
    files: {
      'active-sessions.json': {
        content: JSON.stringify(data, null, 2)
      }
    }
  };

  const response = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Amplect-Office-Bot'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${text}`);
  }

  const result = await response.json();
  
  fs.writeFileSync(GIST_ID_FILE, result.id);
  console.log(`✅ Created Gist: ${result.html_url}`);
  console.log(`📍 Raw URL: https://gist.githubusercontent.com/${result.owner.login}/${result.id}/raw/active-sessions.json`);
  
  return result;
}

createTestGist().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
