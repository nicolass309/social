const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  return res;
}

// Auth
export async function login(username: string, password: string) {
  const res = await fetchAPI('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function logout() {
  const res = await fetchAPI('/api/auth/logout', { method: 'POST' });
  return res.json();
}

export async function getMe() {
  const res = await fetchAPI('/api/auth/me');
  return res.json();
}

// Platform connections
export async function getPlatformStatus(platform: string) {
  const res = await fetchAPI(`/api/connections/${platform}/status`);
  return res.json();
}

export async function getConnectUrl(platform: string) {
  const res = await fetchAPI(`/api/connections/${platform}/auth`);
  return res.json();
}

export async function disconnectPlatform(platform: string) {
  const res = await fetchAPI(`/api/connections/${platform}/disconnect`, { method: 'DELETE' });
  return res.json();
}

// Upload
export async function uploadVideo(file: File, onProgress?: (pct: number) => void): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append('video', file);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload failed')));

    xhr.open('POST', `${API_URL}/api/upload`);
    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

// Posts
export async function getPosts() {
  const res = await fetchAPI('/api/posts');
  return res.json();
}

export async function getPost(id: string) {
  const res = await fetchAPI(`/api/posts/${id}`);
  return res.json();
}

export async function createPost(data: {
  title: string;
  description: string;
  videoUrl: string;
  videoKey: string;
  platforms: string[];
  scheduledAt?: string;
  hashtags?: string;
}) {
  const res = await fetchAPI('/api/posts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deletePost(id: string) {
  const res = await fetchAPI(`/api/posts/${id}`, { method: 'DELETE' });
  return res.json();
}

// Publish
export async function publishPost(id: string) {
  const res = await fetchAPI(`/api/publish/${id}`, { method: 'POST' });
  return res.json();
}

// Scheduler
export async function getScheduledPosts() {
  const res = await fetchAPI('/api/scheduler/scheduled');
  return res.json();
}
