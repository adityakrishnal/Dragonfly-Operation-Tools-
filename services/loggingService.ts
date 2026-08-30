
import { ProcessingStats } from '../types';

interface LogPayload {
  timestamp: string;
  user: string;
  files: {
    pdf: string;
    excel: string;
    qr?: string;
  };
  userAgent: string;
}

interface LogResult {
  success: boolean;
  message: string;
}

export const logSessionToGithub = async (
  user: string,
  pdfName: string,
  excelName: string,
  qrName?: string
): Promise<LogResult> => {
  // Check for required configuration
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || 'AdityaKrishna'; 
  const repo = process.env.GITHUB_REPO || 'Dragonfly';

  if (!token) {
    return { success: false, message: "Missing GITHUB_TOKEN. Logging skipped." };
  }

  const timestamp = new Date().toISOString();
  // Create a safe filename from user and timestamp (allow alphanumeric, @, ., -, _)
  const safeUser = user.replace(/[^a-zA-Z0-9@._-]/g, '_');
  const filename = `logs/${timestamp.replace(/:/g, '-')}_${safeUser}.json`;

  const payload: LogPayload = {
    timestamp,
    user,
    files: {
      pdf: pdfName,
      excel: excelName,
      qr: qrName || "N/A"
    },
    userAgent: navigator.userAgent
  };

  try {
    const content = btoa(JSON.stringify(payload, null, 2));

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filename}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Log session: ${user}`,
        content: content,
        committer: {
          name: "Dragonfly Logger",
          email: "logger@dragonfly.app"
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, message: `GitHub API Error: ${errorData.message || 'Unknown error'}` };
    }

    return { success: true, message: "Session logged to GitHub." };
  } catch (error: any) {
    return { success: false, message: `Network Error: ${error.message}` };
  }
};
