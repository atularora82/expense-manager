import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Expense Book Backups";
const TOKEN_KEY = "google-drive-access-token";
const TOKEN_EXPIRY_KEY = "google-drive-token-expires-at";
const KEEP_BACKUP_COUNT = 14;

function driveHeaders(accessToken, extra = {}) {
  return { Authorization: `Bearer ${accessToken}`, ...extra };
}

async function driveJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message || `Google Drive request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export function userHasGoogleProvider(user) {
  return Boolean(
    user?.providerData?.some((provider) => provider.providerId === "google.com")
  );
}

export function cacheGoogleAccessToken(accessToken, expiresInSeconds = 3500) {
  if (!accessToken) return;
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  sessionStorage.setItem(
    TOKEN_EXPIRY_KEY,
    String(Date.now() + expiresInSeconds * 1000)
  );
}

export function clearGoogleAccessTokenCache() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function getCachedGoogleAccessToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
  if (!token || !expiry || Date.now() >= expiry) return null;
  return token;
}

export async function getGoogleDriveAccessToken(auth, googleProvider, options = {}) {
  const { forceRefresh = false } = options;
  if (!forceRefresh) {
    const cached = getCachedGoogleAccessToken();
    if (cached) return cached;
  }

  if (!auth?.currentUser) {
    throw new Error("Sign in with Google to use Drive backup.");
  }

  googleProvider.addScope(DRIVE_SCOPE);
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = credential?.accessToken;

  if (!accessToken) {
    throw new Error("Google Drive permission was not granted.");
  }

  cacheGoogleAccessToken(accessToken);
  return accessToken;
}

async function findFolder(accessToken, folderName) {
  const query = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
  ].join(" and ");

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id,name)");
  url.searchParams.set("pageSize", "1");

  const data = await driveJson(
    await fetch(url, { headers: driveHeaders(accessToken) })
  );
  return data.files?.[0]?.id || null;
}

async function createFolder(accessToken, folderName) {
  const data = await driveJson(
    await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: driveHeaders(accessToken, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    })
  );
  return data.id;
}

export async function ensureBackupFolder(accessToken, existingFolderId = null) {
  if (existingFolderId) {
    const verifyUrl = `https://www.googleapis.com/drive/v3/files/${existingFolderId}?fields=id,trashed`;
    try {
      const data = await driveJson(
        await fetch(verifyUrl, { headers: driveHeaders(accessToken) })
      );
      if (!data.trashed) return existingFolderId;
    } catch {
      // folder missing — recreate below
    }
  }

  const existing = await findFolder(accessToken, FOLDER_NAME);
  if (existing) return existing;
  return createFolder(accessToken, FOLDER_NAME);
}

function backupFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `expense-book-backup-${stamp}.json`;
}

export async function uploadBackupToDrive(accessToken, folderId, backup) {
  const metadata = {
    name: backupFileName(),
    mimeType: "application/json",
    parents: [folderId],
  };
  const fileBody = JSON.stringify(backup, null, 2);
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  form.append("file", new Blob([fileBody], { type: "application/json" }));

  const data = await driveJson(
    await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,createdTime",
      {
        method: "POST",
        headers: driveHeaders(accessToken),
        body: form,
      }
    )
  );

  return data;
}

async function pruneOldBackups(accessToken, folderId, keep = KEEP_BACKUP_COUNT) {
  const query = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("orderBy", "createdTime desc");
  url.searchParams.set("fields", "files(id,name,createdTime)");
  url.searchParams.set("pageSize", "100");

  const data = await driveJson(
    await fetch(url, { headers: driveHeaders(accessToken) })
  );

  const stale = (data.files || []).slice(keep);
  await Promise.all(
    stale.map((file) =>
      fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
        method: "DELETE",
        headers: driveHeaders(accessToken),
      })
    )
  );
}

export async function runGoogleDriveBackup({
  auth,
  googleProvider,
  backup,
  schedule,
  forceAuth = false,
}) {
  const accessToken = await getGoogleDriveAccessToken(auth, googleProvider, {
    forceRefresh: forceAuth,
  });
  const folderId = await ensureBackupFolder(accessToken, schedule.driveFolderId);
  const uploaded = await uploadBackupToDrive(accessToken, folderId, backup);
  await pruneOldBackups(accessToken, folderId);
  return { folderId, uploaded };
}
