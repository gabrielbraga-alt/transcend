import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rtbwdzvtphnhredutwur.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0YndkenZ0cGhuaHJlZHV0d3VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMTE2NjksImV4cCI6MjEwMDU4NzY2OX0.PHV0DFj4pp5_X-Dc2IrtlF7pFibTxeGZAdj41mKOzSw';

export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
