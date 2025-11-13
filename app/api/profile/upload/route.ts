import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const wallet = formData.get('wallet') as string;

    if (!image || !wallet) {
      return NextResponse.json({ error: 'Image and wallet required' }, { status: 400 });
    }

    // Create profiles directory if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public');
    const profilesDir = path.join(publicDir, 'images', 'profiles');
    await mkdir(profilesDir, { recursive: true });

    // Create unique filename
    const timestamp = Date.now();
    const extension = path.extname(image.name || '.jpg');
    const filename = `${wallet}-${timestamp}${extension}`;
    const imagePath = path.join(profilesDir, filename);
    const imageUrl = `/images/profiles/${filename}`;

    // Save the image
    const bytes = await image.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(imagePath, buffer);

    // Now update the profile with the new image URL
    const profileResponse = await fetch('http://localhost:3000/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        profilePicture: imageUrl,
        type: 'profilePicture'
      })
    });

    if (!profileResponse.ok) {
      // If profile update fails, return error but don't delete the image
      console.error('Failed to update profile with new image URL');
      return NextResponse.json({ 
        success: true, 
        url: imageUrl,
        warning: 'Image saved but profile not updated'
      });
    }

    return NextResponse.json({ 
      success: true, 
      url: imageUrl 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 });
  }
}