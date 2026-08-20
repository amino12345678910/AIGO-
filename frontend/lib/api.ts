const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface Subject {
  id: string;
  name: string;
  grade: string;
  branch: string;
  document_count: number;
  created_at: string;
}

export interface Document {
  id: string;
  subject_id: string;
  filename: string;
  file_url: string;
  file_type: string;
  status: "pending" | "processing" | "indexed" | "failed";
  chunk_count: number;
  error_msg?: string;
  uploaded_at: string;
}

export interface Session {
  id: string;
  student_id: string;
  subject_id: string;
  subject_name: string;
  grade: string;
  started_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  chunks_used: string[];
  created_at: string;
}

export async function fetchSubjects(): Promise<Subject[]> {
  const res = await fetch(`${API_URL}/api/admin/subjects`);
  if (!res.ok) throw new Error("Failed to fetch subjects");
  return res.json();
}

export async function fetchSubject(id: string): Promise<Subject> {
  const res = await fetch(`${API_URL}/api/admin/subjects/${id}`);
  if (!res.ok) throw new Error("Failed to fetch subject");
  return res.json();
}

export async function createSubject(data: {
  name: string;
  grade: string;
  branch: string;
}): Promise<Subject> {
  const res = await fetch(`${API_URL}/api/admin/subjects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create subject");
  return res.json();
}

export async function deleteSubject(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/subjects/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete subject");
}

export async function fetchDocuments(
  subjectId: string
): Promise<Document[]> {
  const res = await fetch(
    `${API_URL}/api/admin/documents?subjectId=${subjectId}`
  );
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function uploadDocument(
  subjectId: string,
  file: File
): Promise<{ id: string; status: string }> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("subjectId", subjectId);

  const res = await fetch(`${API_URL}/api/admin/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload document");
  return res.json();
}

export async function fetchDocumentStatus(
  id: string
): Promise<{ id: string; status: string; chunk_count: number; error_msg?: string }> {
  const res = await fetch(`${API_URL}/api/admin/documents/${id}/status`);
  if (!res.ok) throw new Error("Failed to fetch document status");
  return res.json();
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/admin/documents/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete document");
}

export async function startSession(
  studentId: string,
  subjectId: string
): Promise<Session> {
  const res = await fetch(`${API_URL}/api/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId, subjectId }),
  });
  if (!res.ok) throw new Error("Failed to start session");
  return res.json();
}

export async function fetchSession(
  id: string
): Promise<{ session: Session; messages: Message[] }> {
  const res = await fetch(`${API_URL}/api/session/${id}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export function sendMessage(
  sessionId: string,
  content: string,
  onChunk: (data: { type: string; text?: string; chunksUsed?: string[]; error?: string }) => void,
  onDone: () => void
): void {
  fetch(`${API_URL}/api/session/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  }).then((response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((line) => line.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "done") {
              onDone();
            } else {
              onChunk(data);
            }
          } catch {}
        }
      }
    };

    processStream();
  });
}
