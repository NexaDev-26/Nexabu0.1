# Environment Variables Guide

## Overview

This document describes all environment variables used in the Nexabu application.

## Required Variables

### Firebase Configuration

These are **required** for the application to function.

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

**Where to find:**
1. Go to Firebase Console → Project Settings
2. Scroll down to "Your apps" section
3. Click on your web app or create one
4. Copy the configuration values

**Important:** All Vite environment variables must be prefixed with `VITE_` to be accessible in the browser.

### Google Gemini API (SmartBot)

Required for AI SmartBot functionality.

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

**Where to get:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key

**Note:** For production, consider restricting the API key to your domain.

## Optional Variables

### Environment Indicator

```env
VITE_ENV=development|production|staging
```

Used to distinguish between environments. Defaults to `development` if not set.

### Feature Flags (Future Use)

```env
VITE_ENABLE_WHATSAPP=false
VITE_ENABLE_SMS=false
VITE_ENABLE_EMAIL=false
```

## Development Setup

1. **Create `.env.local` file** in the root directory:

```env
# Copy from .env.example if it exists, or create new
VITE_FIREBASE_API_KEY=your_dev_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-dev-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-dev-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-dev-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_dev_sender_id
VITE_FIREBASE_APP_ID=your_dev_app_id
VITE_GEMINI_API_KEY=your_dev_gemini_key
VITE_ENV=development
```

2. **Restart dev server** after adding/updating variables:
   ```bash
   npm run dev
   ```

## Production Setup

1. **Create `.env.production` file** (or use platform-specific env config):

```env
VITE_FIREBASE_API_KEY=your_prod_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-prod-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-prod-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-prod-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_prod_sender_id
VITE_FIREBASE_APP_ID=your_prod_app_id
VITE_GEMINI_API_KEY=your_prod_gemini_key
VITE_ENV=production
```

2. **Platform-specific configuration:**
   - **Firebase Hosting:** Use `.env.production` or Firebase Hosting environment config
   - **Vercel:** Add variables in Vercel Dashboard → Settings → Environment Variables
   - **Netlify:** Add variables in Netlify Dashboard → Site Settings → Environment Variables

## Accessing Variables in Code

In your code, access variables like this:

```typescript
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isProduction = import.meta.env.VITE_ENV === 'production';
```

**Note:** Variables are replaced at build time. Changes require a rebuild.

## Security Considerations

1. **Never commit `.env` files** to version control
2. **Add `.env*` to `.gitignore`** (except `.env.example`)
3. **Use different Firebase projects** for dev/staging/production
4. **Restrict API keys** to specific domains/IPs when possible
5. **Rotate keys regularly** if compromised
6. **Use Firebase App Check** to prevent unauthorized access

## Type Safety

For TypeScript, you can define types:

```typescript
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

## Validation

The application should validate required environment variables at startup:

```typescript
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  // ... etc
];

requiredEnvVars.forEach(varName => {
  if (!import.meta.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
  }
});
```

## Troubleshooting

### Variables not loading
- Ensure variables start with `VITE_`
- Restart dev server after changes
- Check for typos in variable names
- Verify `.env` file is in root directory

### Wrong values in production
- Verify `.env.production` is correct
- Check platform-specific environment variable configuration
- Ensure build uses correct environment file
- Clear build cache and rebuild

### Security warnings
- Never expose sensitive keys in client-side code
- Use Firebase Security Rules for backend logic
- Consider using Firebase Cloud Functions for sensitive operations

## Example `.env.example`

Create a `.env.example` file (committed to repo) as a template:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Google Gemini API
VITE_GEMINI_API_KEY=

# Environment
VITE_ENV=development
```

---

**Last Updated:** 2024

