-- CC & LUCIA Central Kitchen - Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PROFILES TABLE (User Management) ====================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'buyer')),
    unit TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" 
    ON profiles FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==================== INVENTORY TABLE (Stock Management) ====================
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    max_order INTEGER NOT NULL DEFAULT 0,
    meat_category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Enable RLS on inventory
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Inventory RLS Policies
CREATE POLICY "Anyone can view inventory" 
    ON inventory FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Only admins can insert inventory" 
    ON inventory FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can update inventory" 
    ON inventory FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete inventory" 
    ON inventory FOR DELETE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==================== ORDERS TABLE ====================
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    vat DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_id UUID REFERENCES profiles(id),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    tax_week INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'out_for_delivery', 'completed', 'cancelled')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Orders RLS Policies
CREATE POLICY "Users can view own unit orders" 
    ON orders FOR SELECT 
    TO authenticated 
    USING (
        unit = (SELECT unit FROM profiles WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Buyers can create orders" 
    ON orders FOR INSERT 
    TO authenticated 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'buyer'
        )
    );

CREATE POLICY "Admins can update orders" 
    ON orders FOR UPDATE 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==================== MESSAGES TABLE ====================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES profiles(id) NOT NULL,
    from_name TEXT NOT NULL,
    from_unit TEXT,
    to_user_id UUID REFERENCES profiles(id),
    to_role TEXT NOT NULL CHECK (to_role IN ('admin', 'buyer')),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_urgent BOOLEAN DEFAULT false,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Messages RLS Policies
CREATE POLICY "Users can view messages sent to them" 
    ON messages FOR SELECT 
    TO authenticated 
    USING (
        to_user_id = auth.uid()
        OR from_user_id = auth.uid()
        OR (
            to_role = 'admin' 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
    );

CREATE POLICY "Users can send messages" 
    ON messages FOR INSERT 
    TO authenticated 
    WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "Users can update own messages (mark as read)" 
    ON messages FOR UPDATE 
    TO authenticated 
    USING (
        to_user_id = auth.uid()
        OR (
            to_role = 'admin' 
            AND EXISTS (
                SELECT 1 FROM profiles 
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
    );

-- ==================== PREP SHEETS TABLE ====================
CREATE TABLE IF NOT EXISTS prep_sheets (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES profiles(id)
);

-- Enable RLS on prep_sheets
ALTER TABLE prep_sheets ENABLE ROW LEVEL SECURITY;

-- Prep Sheets RLS Policies
CREATE POLICY "Anyone can view prep sheets" 
    ON prep_sheets FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Only admins can modify prep sheets" 
    ON prep_sheets FOR ALL 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- ==================== ACTIVITY LOG TABLE ====================
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    user_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on activity_log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Activity Log RLS Policies
CREATE POLICY "Admins can view activity log" 
    ON activity_log FOR SELECT 
    TO authenticated 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Users can create activity log entries" 
    ON activity_log FOR INSERT 
    TO authenticated 
    WITH CHECK (user_id = auth.uid());

-- ==================== REALTIME SETUP ====================
-- Enable realtime for all tables
BEGIN;
    -- Drop existing publications if they exist
    DROP PUBLICATION IF EXISTS supabase_realtime;
    
    -- Create new publication
    CREATE PUBLICATION supabase_realtime;
    
    -- Add tables to publication
    ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE prep_sheets;
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
COMMIT;

-- ==================== FUNCTIONS ====================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_inventory_updated_at 
    BEFORE UPDATE ON inventory 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prep_sheets_updated_at 
    BEFORE UPDATE ON prep_sheets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, name, role, unit)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
        NEW.raw_user_meta_data->>'unit'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ==================== INITIAL DATA ====================
-- Insert default admin user (you'll need to sign up with this email in Supabase Auth)
-- The profile will be created automatically via the trigger

-- Insert sample inventory items (these will be synced from the app)
-- The app will populate this data on first sync

-- ==================== INDEXES ====================
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category);
CREATE INDEX IF NOT EXISTS idx_orders_unit ON orders(unit);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tax_week ON orders(tax_week);
CREATE INDEX IF NOT EXISTS idx_messages_to_user ON messages(to_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_from_user ON messages(from_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_prep_sheets_date ON prep_sheets(date);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);