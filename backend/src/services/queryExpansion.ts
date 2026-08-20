const EXPANSION_RULES: Record<string, string[]> = {
  supervisor: ["encadrant", "maitre", "chef", "directeur"],
  report: ["rapport", "memoire", "these", "document"],
  topic: ["sujet", "theme", "problematique"],
  project: ["projet", "travail", "etude"],
  course: ["cours", "matiere", "module", "programme"],
  exam: ["examen", "controle", "evaluation", "test"],
  exercise: ["exercice", "problem", "application"],
  student: ["etudiant", "apprenant", "eleve"],
  teacher: ["professeur", "enseignant", "instructeur"],
  math: ["mathematiques", "algebre", "geometrie", "analyse"],
  physics: ["physique", "mecanique", "thermodynamique", "optics"],
  chemistry: ["chimie", "organique", "minerale"],
  computer: ["informatique", "programmation", "logiciel", "code"],
};

const EXPANSION_RULES_AR: Record<string, string[]> = {
  مشرف: ["مدير", "رئيس"],
  تقرير: ["رسالة", "وثيقة"],
  مشروع: ["دراسة", "عمل"],
  دورة: ["مادة", "برنامج"],
  امتحان: ["اختبار", "تقييم"],
  تمرين: ["مسألة", "تطبيق"],
  طالب: ["متعلم", "تلميذ"],
 أستاذ: ["معلم", "محاضر"],
};

export function expandQuery(query: string): string {
  const lowerQuery = query.toLowerCase();
  const expansions: string[] = [];

  for (const [keyword, synonyms] of Object.entries(EXPANSION_RULES)) {
    if (lowerQuery.includes(keyword)) {
      expansions.push(...synonyms);
    }
  }

  for (const [keyword, synonyms] of Object.entries(EXPANSION_RULES_AR)) {
    if (query.includes(keyword)) {
      expansions.push(...synonyms);
    }
  }

  if (expansions.length === 0) return query;
  return query + " " + expansions.join(" ");
}

export function isKnowledgeBaseQuestion(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  const keywords = [
    "report", "document", "topic", "supervisor", "course", "subject",
    "rapport", "document", "sujet", "encadrant", "cours", "matiere",
    "what does", "what is", "explain", "summarize", "based on",
    "que dit", "que contient", "explique", "resume", "selon",
  ];
  return keywords.some((kw) => lowerQuery.includes(kw));
}
