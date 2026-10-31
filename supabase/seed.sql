-- Create a mock user in the internal auth schema
-- This allows local development login without needing a real SMTP server
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, role, aud, confirmation_token)
VALUES (
    'd7b1f3e0-1234-4321-8888-999999999999',
    'contributor@zsweep.dev',
    crypt('password123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    'confirmed'
) ON CONFLICT (id) DO NOTHING;

-- Create associated profile for the test user
INSERT INTO public.profiles (id, username, avatar_url, updated_at)
VALUES (
    'd7b1f3e0-1234-4321-8888-999999999999',
    'neovim_knight',
    'https://api.dicebear.com/7.x/bottts/svg?seed=zsweep',
    now()
) ON CONFLICT (id) DO NOTHING;

-- Insert diverse game results matching zsweep's standard and time modes
INSERT INTO public.game_results (user_id, mode, setting, win, grids, accuracy, total_mines, time)
VALUES 
    ('d7b1f3e0-1234-4321-8888-999999999999', 'standard', '30x16', true, 1, 95, 99, 124),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'standard', '16x16', true, 1, 100, 40, 58),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'standard', '9x9', true, 1, 100, 10, 12),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'time', '15', true, 2, 98, 20, 15),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'time', '30', true, 3, 97, 30, 30),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'time', '60', true, 5, 96, 50, 60),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'standard', '30x16', false, 0, 75, 0, 45),
    ('d7b1f3e0-1234-4321-8888-999999999999', 'standard', '30x16', true, 1, 92, 99, 135);
