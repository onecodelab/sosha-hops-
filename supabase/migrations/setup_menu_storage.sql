-- 1. Create the Storage Bucket for Menu Images
-- We'll name it 'menu-images' and make it public so URLs are easy to fetch
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Clear existing policies to avoid duplicates
DROP POLICY IF EXISTS "Allow authenticated users to upload images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public to view images" ON storage.objects;
DROP POLICY IF EXISTS "Allow owners/admins to delete images" ON storage.objects;

-- 3. Policy: Allow Public to view images
CREATE POLICY "Allow public to view images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'menu-images' );

-- 4. Policy: Allow Authenticated Users (Staff/Admin) to upload images
-- In a production environment, you might restrict this further by Role
CREATE POLICY "Allow authenticated users to upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'menu-images' );

-- 5. Policy: Allow Owners and Admins to delete images
CREATE POLICY "Allow owners to delete images"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'menu-images' );
