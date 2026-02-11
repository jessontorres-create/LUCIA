# CC & LUCIA Central Kitchen - Supabase Integration

This document explains how to set up Supabase Auth and Realtime synchronization for the CC & LUCIA Central Kitchen Management System.

## Features

### ✅ Supabase Auth
- Secure user authentication with email/password
- Automatic profile creation on signup
- Role-based access control (Admin/Buyer)
- Cross-device login support

### ✅ Real-time Synchronization
- **Stock Updates**: Changes to inventory are instantly synced across all devices
- **Orders**: When a buyer places an order, admins see it immediately
- **Messages**: Messages between admin and buyers appear in real-time
- **Prep Sheets**: Daily prep sheet updates sync across all devices

## Setup Instructions

### Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (e.g., "cc-lucia-kitchen")
3. Wait for the project to be created (this may take a few minutes)

### Step 2: Set Up Database Schema

1. In your Supabase project, go to the **SQL Editor**
2. Create a new query
3. Copy and paste the entire contents of `supabase_schema.sql`
4. Click **Run** to execute the schema

This will create:
- `profiles` table (user profiles)
- `inventory` table (stock items)
- `orders` table (order history)
- `messages` table (communications)
- `prep_sheets` table (daily prep sheets)
- `activity_log` table (audit trail)

### Step 3: Enable Realtime

1. Go to **Database** → **Replication**
2. Enable **Realtime** for the following tables:
   - `inventory`
   - `orders`
   - `messages`
   - `prep_sheets`

### Step 4: Get Your API Credentials

1. Go to **Project Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://your-project.supabase.co`)
   - **anon/public** key (starts with `eyJhbGciOiJIUzI1NiIs...`)

### Step 5: Configure the App

1. Open `supabase-integration.js`
2. Replace the placeholder values with your actual credentials:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

### Step 6: Deploy

Upload all files to your web server:
- `index.html`
- `supabase-integration.js`
- `supabase_schema.sql` (for reference)

## How It Works

### Authentication Flow

1. **Signup**: New users create an account with email/password
2. **Profile Creation**: A profile is automatically created in the `profiles` table
3. **Login**: Users authenticate via Supabase Auth
4. **Session**: Session is persisted across page reloads

### Real-time Sync Flow

```
Device A (Admin)          Supabase              Device B (Buyer)
     |                        |                        |
     | Update Stock           |                        |
     | ─────────────────────> |                        |
     |                        | Broadcast Change       |
     |                        | ─────────────────────> |
     |                        |                        | Update UI
```

### Stock Updates

When an admin updates stock:
1. Stock is updated in local storage
2. Change is sent to Supabase
3. All connected devices receive the update
4. UI updates automatically

### Order Placement

When a buyer places an order:
1. Order is saved locally
2. Order is sent to Supabase
3. Admin dashboard receives the new order in real-time
4. Stock levels are updated across all devices

### Messaging

When a message is sent:
1. Message is saved locally
2. Message is sent to Supabase
3. Recipient receives the message instantly
4. Unread message count updates

## User Roles

### Admin
- Full access to all features
- Can manage inventory
- Can view all orders
- Can send/receive messages
- Can manage users

### Buyer
- Can view inventory
- Can place orders
- Can view own order history
- Can send/receive messages
- Can view prep sheets

## Security

### Row Level Security (RLS)

All tables have RLS policies enabled:
- Users can only access their own data
- Admins can access all data
- Orders are filtered by unit
- Messages are filtered by recipient

### Authentication

- Passwords are hashed by Supabase Auth
- Sessions are managed securely
- API keys are read-only (anon key)

## Troubleshooting

### "Supabase Not Configured" Warning

If you see this warning, it means the Supabase credentials haven't been set. Follow Step 5 above to configure the app.

### Sync Not Working

1. Check that Realtime is enabled in Supabase
2. Verify your API credentials are correct
3. Check browser console for errors
4. Ensure you're using HTTPS (required for some browsers)

### Login Issues

1. Verify the user exists in Supabase Auth
2. Check that the profile was created in the `profiles` table
3. Ensure email verification is complete (if enabled)

## API Reference

### Supabase Client

```javascript
// Initialize
const supabase = supabase.createClient(url, key);

// Auth
await supabase.auth.signUp({ email, password, options: { data: { name, role, unit } } });
await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signOut();

// Database
await supabase.from('table').select('*');
await supabase.from('table').insert(data);
await supabase.from('table').update(data).eq('id', id);
await supabase.from('table').delete().eq('id', id);

// Realtime
supabase.channel('name').on('postgres_changes', callback).subscribe();
```

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify your Supabase configuration
3. Review the Supabase documentation at [supabase.com/docs](https://supabase.com/docs)

## License

This project is proprietary software for CC & LUCIA Central Kitchen.