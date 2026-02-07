import fs from 'fs';
import path from 'path';

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const requiredVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
];

function validateEnv() {
  console.log(`${YELLOW}Validating environment variables...${NC}`);

  const envFiles = ['.env.local', '.env'];
  let envContent = '';
  let envFileFound = false;

  for (const file of envFiles) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`${GREEN}Found ${file}${NC}`);
      envContent += fs.readFileSync(filePath, 'utf8') + '\n';
      envFileFound = true;
    }
  }

  if (!envFileFound) {
    console.log(`${YELLOW}No .env.local or .env file found. Validation will rely on shell environment variables.${NC}`);
  }

  // Parse env content
  const envVars = { ...process.env };
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (key && !key.startsWith('#')) {
        envVars[key] = value;
      }
    }
  });

  let errors = [];

  for (const varName of requiredVars) {
    if (!envVars[varName]) {
      // In Docker mode, some vars might be injected via docker-compose.yml defaults
      // But for local dev they should be present.
      // We'll mark as error to ensure user knows.
      errors.push(`Missing required variable: ${varName}`);
    } else {
        if (varName.endsWith('_URL')) {
             if (!envVars[varName].startsWith('http')) {
                 errors.push(`Invalid format for ${varName}: Must start with http(s)`);
             }
        }
    }
  }

  if (errors.length > 0) {
    console.log(`${RED}Environment validation failed:${NC}`);
    errors.forEach(err => console.log(`  - ${err}`));
    process.exit(1);
  } else {
    console.log(`${GREEN}Environment validation passed.${NC}`);
  }
}

validateEnv();
